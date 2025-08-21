const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { auditMiddleware } = require('../middleware/auth');

const router = express.Router();

// ========================================
// ESQUEMAS DE VALIDACIÓN
// ========================================

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'El email debe tener un formato válido',
    'any.required': 'El email es requerido'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es requerida'
  })
});

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 100 caracteres',
    'any.required': 'El nombre es requerido'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'El email debe tener un formato válido',
    'any.required': 'El email es requerido'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres',
    'any.required': 'La contraseña es requerida'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Las contraseñas no coinciden',
    'any.required': 'Debes confirmar la contraseña'
  })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'El refresh token es requerido'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'La contraseña actual es requerida'
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
    'any.required': 'La nueva contraseña es requerida'
  }),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Las contraseñas no coinciden',
    'any.required': 'Debes confirmar la nueva contraseña'
  })
});

// ========================================
// RUTAS DE AUTENTICACIÓN
// ========================================

/**
 * POST /api/auth/register
 * Registro de nuevos usuarios profesionales
 */
router.post('/register', 
  auditMiddleware('CREATE', 'USER'),
  asyncHandler(async (req, res) => {
    // Validar datos de entrada
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { name, email, password } = value;

    try {
      // Verificar si el usuario ya existe
      const existingUser = await database.get(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        return res.status(409).json({
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'Ya existe un usuario con este email'
          }
        });
      }

      // Encriptar contraseña
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Crear usuario en la base de datos
      const result = await database.run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, 'professional']
      );

      // Obtener usuario creado
      const user = await database.get(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        [result.id]
      );

      // Generar tokens
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        process.env.JWT_SECRET || 'default_secret_change_in_production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      const refreshToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

      // Crear sesión
      await database.run(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt.toISOString()]
      );

      // Actualizar estadísticas del sistema
      await database.run(
        'UPDATE system_stats SET value = value + 1 WHERE metric = "total_users"'
      );

      // Respuesta exitosa
      res.status(201).json({
        message: 'Usuario registrado exitosamente',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      console.error('Error en registro:', error);
      throw error;
    }
  })
);

/**
 * POST /api/auth/login
 * Login de usuarios existentes
 */
router.post('/login', 
  auditMiddleware('LOGIN', 'USER'),
  asyncHandler(async (req, res) => {
    // Validar datos de entrada
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { email, password } = value;

    try {
      // Buscar usuario en la base de datos
      const user = await database.get(
        'SELECT id, name, email, password, role, active FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        });
      }

      if (!user.active) {
        return res.status(401).json({
          error: {
            code: 'USER_INACTIVE',
            message: 'Tu cuenta está inactiva. Contacta al administrador.'
          }
        });
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        });
      }

      // Generar tokens
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        process.env.JWT_SECRET || 'default_secret_change_in_production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      const refreshToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

      // Crear nueva sesión
      await database.run(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt.toISOString()]
      );

      // Respuesta exitosa
      res.json({
        message: 'Login exitoso',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  })
);

/**
 * POST /api/auth/refresh
 * Renovar token de acceso usando refresh token
 */
router.post('/refresh', 
  auditMiddleware('REFRESH', 'TOKEN'),
  asyncHandler(async (req, res) => {
    // Validar datos de entrada
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { refreshToken } = value;

    try {
      // Verificar refresh token en la base de datos
      const session = await database.get(
        'SELECT s.*, u.id, u.email, u.role, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime("now") AND u.active = 1',
        [refreshToken]
      );

      if (!session) {
        return res.status(401).json({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Token de renovación inválido o expirado'
          }
        });
      }

      // Generar nuevo access token
      const newAccessToken = jwt.sign(
        {
          id: session.id,
          email: session.email,
          role: session.role,
          name: session.name
        },
        process.env.JWT_SECRET || 'default_secret_change_in_production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Actualizar último uso de la sesión
      await database.run(
        'UPDATE sessions SET last_used = datetime("now") WHERE token = ?',
        [refreshToken]
      );

      // Respuesta exitosa
      res.json({
        message: 'Token renovado exitosamente',
        tokens: {
          accessToken: newAccessToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      console.error('Error en renovación de token:', error);
      throw error;
    }
  })
);

/**
 * POST /api/auth/logout
 * Logout del usuario (invalidar refresh token)
 */
router.post('/logout', 
  auditMiddleware('LOGOUT', 'USER'),
  asyncHandler(async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const tokenParts = authHeader.split(' ');
        if (tokenParts.length === 2 && tokenParts[0] === 'Bearer') {
          const token = tokenParts[1];
          
          // Invalidar sesión actual
          await database.run(
            'DELETE FROM sessions WHERE token = ?',
            [token]
          );
        }
      }

      res.json({
        message: 'Logout exitoso'
      });

    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  })
);

/**
 * GET /api/auth/me
 * Obtener información del usuario autenticado
 */
router.get('/me', 
  auditMiddleware('READ', 'USER_PROFILE'),
  asyncHandler(async (req, res) => {
    try {
      const user = await database.get(
        'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (!user) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado'
          }
        });
      }

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      throw error;
    }
  })
);

/**
 * PUT /api/auth/me
 * Actualizar información del usuario autenticado
 */
router.put('/me', 
  auditMiddleware('UPDATE', 'USER_PROFILE'),
  asyncHandler(async (req, res) => {
    try {
      const { name, email } = req.body;

      // Validar datos
      if (name && name.length < 2) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El nombre debe tener al menos 2 caracteres'
          }
        });
      }

      if (email && !email.includes('@')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El email debe tener un formato válido'
          }
        });
      }

      // Verificar si el email ya existe (si se está cambiando)
      if (email && email !== req.user.email) {
        const existingUser = await database.get(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, req.user.id]
        );

        if (existingUser) {
          return res.status(409).json({
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Ya existe un usuario con este email'
            }
          });
        }
      }

      // Actualizar usuario
      const updateFields = [];
      const updateValues = [];

      if (name) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }

      if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }

      if (updateFields.length > 0) {
        updateValues.push(req.user.id);
        await database.run(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      // Obtener usuario actualizado
      const updatedUser = await database.get(
        'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      );

      res.json({
        message: 'Usuario actualizado exitosamente',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        }
      });

    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  })
);

/**
 * POST /api/auth/change-password
 * Cambiar contraseña del usuario autenticado
 */
router.post('/change-password', 
  auditMiddleware('UPDATE', 'USER_PASSWORD'),
  asyncHandler(async (req, res) => {
    // Validar datos de entrada
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { currentPassword, newPassword } = value;

    try {
      // Obtener contraseña actual del usuario
      const user = await database.get(
        'SELECT password FROM users WHERE id = ?',
        [req.user.id]
      );

      // Verificar contraseña actual
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'La contraseña actual es incorrecta'
          }
        });
      }

      // Encriptar nueva contraseña
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña
      await database.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedNewPassword, req.user.id]
      );

      // Invalidar todas las sesiones del usuario (forzar re-login)
      await database.run(
        'DELETE FROM sessions WHERE user_id = ?',
        [req.user.id]
      );

      res.json({
        message: 'Contraseña cambiada exitosamente. Debes iniciar sesión nuevamente.'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  })
);

/**
 * GET /api/auth/sessions
 * Obtener sesiones activas del usuario
 */
router.get('/sessions', 
  auditMiddleware('READ', 'USER_SESSIONS'),
  asyncHandler(async (req, res) => {
    try {
      const sessions = await database.all(
        'SELECT id, token, expires_at, created_at, last_used FROM sessions WHERE user_id = ? AND expires_at > datetime("now") ORDER BY created_at DESC',
        [req.user.id]
      );

      res.json({
        sessions: sessions.map(session => ({
          id: session.id,
          expiresAt: session.expires_at,
          createdAt: session.created_at,
          lastUsed: session.last_used,
          isActive: new Date(session.expires_at) > new Date()
        }))
      });

    } catch (error) {
      console.error('Error obteniendo sesiones:', error);
      throw error;
    }
  })
);

/**
 * DELETE /api/auth/sessions/:sessionId
 * Invalidar una sesión específica
 */
router.delete('/sessions/:sessionId', 
  auditMiddleware('DELETE', 'USER_SESSION'),
  asyncHandler(async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);

      // Verificar que la sesión pertenece al usuario
      const session = await database.get(
        'SELECT id FROM sessions WHERE id = ? AND user_id = ?',
        [sessionId, req.user.id]
      );

      if (!session) {
        return res.status(404).json({
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Sesión no encontrada'
          }
        });
      }

      // Eliminar sesión
      await database.run(
        'DELETE FROM sessions WHERE id = ?',
        [sessionId]
      );

      res.json({
        message: 'Sesión invalidada exitosamente'
      });

    } catch (error) {
      console.error('Error invalidando sesión:', error);
      throw error;
    }
  })
);

module.exports = router;
