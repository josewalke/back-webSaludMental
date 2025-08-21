const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../middleware/auth-simple');
const bcrypt = require('bcryptjs');

/**
 * POST /api/auth/register
 * Registro de usuario simple
 */
router.post('/register', async (req, res) => {
  try {
    const { 
      nombre, 
      apellidos, 
      edad, 
      genero, 
      correo, 
      orientacionSexual, 
      password 
    } = req.body;

    // Validación básica
    if (!nombre || !apellidos || !correo || !password) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findByEmail(correo);
    if (existingUser) {
      return res.status(409).json({
        error: 'El email ya está registrado'
      });
    }

    // Crear usuario
    const user = await User.create({
      nombre,
      apellidos,
      edad: edad || '',
      genero: genero || '',
      correo,
      orientacionSexual: orientacionSexual || '',
      password
    });

    // Generar token
    const accessToken = generateToken(user.id, 'user');

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          apellidos: user.apellidos,
          correo: user.correo
        },
        accessToken
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/login
 * Login simple
 */
router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;

    // Validación básica
    if (!correo || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const user = await User.findByEmail(correo);
    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Generar token
    const accessToken = generateToken(user.id, 'user');

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          apellidos: user.apellidos,
          correo: user.correo
        },
        accessToken
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;
