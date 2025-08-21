const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const database = require('../database/connection');

/**
 * Middleware de Autenticación Robusto
 * Múltiples capas de seguridad para proteger la API
 */

// Configuración de seguridad
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback_secret_change_in_production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  algorithm: 'HS512', // Algoritmo más seguro
  issuer: 'love-on-the-brain-api',
  audience: 'love-on-the-brain-users'
};

// Lista negra de tokens (para logout)
const tokenBlacklist = new Set();

/**
 * Generar token JWT con claims de seguridad
 */
function generateToken(userId, userRole = 'user') {
  const payload = {
    userId,
    userRole,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 horas
    jti: require('crypto').randomBytes(16).toString('hex'), // ID único del token
    iss: JWT_CONFIG.issuer,
    aud: JWT_CONFIG.audience
  };

  return jwt.sign(payload, JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm,
    expiresIn: JWT_CONFIG.expiresIn
  });
}

/**
 * Generar refresh token
 */
function generateRefreshToken(userId) {
  const payload = {
    userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días
    jti: require('crypto').randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm
  });
}

/**
 * Verificar token JWT con validaciones robustas
 */
function verifyToken(token) {
  try {
    // Verificar que el token no esté en la lista negra
    if (tokenBlacklist.has(token)) {
      throw new Error('Token invalidado');
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });

    // Validaciones adicionales de seguridad
    if (!decoded.userId || !decoded.jti) {
      throw new Error('Token malformado');
    }

    // Verificar que el token no sea muy antiguo (máximo 24 horas)
    const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
    if (tokenAge > 24 * 60 * 60) {
      throw new Error('Token muy antiguo');
    }

    return decoded;
  } catch (error) {
    throw new Error(`Token inválido: ${error.message}`);
  }
}

/**
 * Middleware de autenticación principal
 */
function authenticateToken(req, res, next) {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        code: 'MISSING_TOKEN'
      });
    }

    // Verificar token
    const decoded = verifyToken(token);
    
    // Agregar información del usuario al request
    req.user = {
      id: decoded.userId,
      role: decoded.userRole,
      tokenId: decoded.jti
    };

    // Registrar acceso exitoso
    logAccess(req, 'AUTH_SUCCESS');
    
    next();
  } catch (error) {
    // Registrar intento de acceso fallido
    logAccess(req, 'AUTH_FAILED', error.message);
    
    return res.status(401).json({
      error: 'Token inválido o expirado',
      code: 'INVALID_TOKEN',
      message: error.message
    });
  }
}

/**
 * Middleware de autorización por roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logAccess(req, 'AUTH_DENIED', `Rol insuficiente: ${req.user.role}`);
      
      return res.status(403).json({
        error: 'Acceso denegado',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Middleware de verificación de propiedad
 */
function requireOwnership(resourceType) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const resourceId = req.params.id || req.params.questionnaireId;
      
      if (!resourceId) {
        return res.status(400).json({
          error: 'ID de recurso requerido',
          code: 'MISSING_RESOURCE_ID'
        });
      }

      // Verificar que el usuario sea propietario del recurso
      let isOwner = false;
      
      if (resourceType === 'questionnaire') {
        const questionnaire = await database.get(
          'SELECT user_id FROM questionnaires WHERE id = ?',
          [resourceId]
        );
        isOwner = questionnaire && questionnaire.user_id === req.user.id;
      } else if (resourceType === 'user') {
        isOwner = parseInt(req.params.id) === req.user.id;
      }

      if (!isOwner && req.user.role !== 'admin') {
        logAccess(req, 'OWNERSHIP_DENIED', `Usuario ${req.user.id} intentó acceder a ${resourceType} ${resourceId}`);
        
        return res.status(403).json({
          error: 'Acceso denegado al recurso',
          code: 'RESOURCE_ACCESS_DENIED',
          resourceType,
          resourceId
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando propiedad:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware de rate limiting por IP
 */
function rateLimitByIP(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      const ipData = requests.get(ip);
      
      if (now > ipData.resetTime) {
        ipData.count = 1;
        ipData.resetTime = now + windowMs;
      } else {
        ipData.count++;
      }
      
      if (ipData.count > maxRequests) {
        logAccess(req, 'RATE_LIMIT_EXCEEDED', `IP: ${ip}, Requests: ${ipData.count}`);
        
        return res.status(429).json({
          error: 'Demasiadas solicitudes',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((ipData.resetTime - now) / 1000)
        });
      }
    }
    
    next();
  };
}

/**
 * Middleware de validación de entrada
 */
function validateInput(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
      
      // Reemplazar body con datos validados
      req.body = value;
      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Error de validación',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Logout - Invalidar token
 */
function logout(token) {
  if (token) {
    tokenBlacklist.add(token);
    
    // Limpiar tokens antiguos de la lista negra (después de 24 horas)
    setTimeout(() => {
      tokenBlacklist.delete(token);
    }, 24 * 60 * 60 * 1000);
  }
}

/**
 * Registrar acceso para auditoría
 */
function logAccess(req, event, details = '') {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id || 'anonymous',
      event,
      details
    };

    // Guardar en base de datos para auditoría
    database.run(
      'INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [
        req.user?.id || null,
        event,
        logData.ip,
        logData.userAgent,
        JSON.stringify(logData)
      ]
    );

    console.log(`🔒 [AUTH] ${event}: ${logData.ip} - ${req.user?.id || 'anonymous'} - ${req.method} ${req.originalUrl}`);
  } catch (error) {
    console.error('Error registrando acceso:', error);
  }
}

/**
 * Middleware de seguridad general
 */
function securityHeaders(req, res, next) {
  // Headers de seguridad
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // CSP (Content Security Policy)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership,
  rateLimitByIP,
  validateInput,
  generateToken,
  generateRefreshToken,
  verifyToken,
  logout,
  securityHeaders,
  logAccess
};
