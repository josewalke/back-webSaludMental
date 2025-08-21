const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const cors = require('cors');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Middleware de Seguridad Empresarial
 * Protección contra ataques comunes y vulnerabilidades
 */

// Configuración de CORS estricta
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solo orígenes específicos
    const allowedOrigins = [
      'http://localhost:3000',
      'https://tu-dominio.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Permitir requests sin origin (como aplicaciones móviles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS bloqueado: ${origin}`);
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 horas
};

// Rate limiting por IP
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    error: 'Demasiadas solicitudes desde esta IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Has excedido el límite de solicitudes. Intenta de nuevo en 15 minutos.',
      retryAfter: Math.ceil(15 * 60 / 1000)
    });
  }
});

// Rate limiting más estricto para endpoints sensibles
const strictRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 requests por IP
  message: {
    error: 'Demasiadas solicitudes en endpoint sensible',
    code: 'STRICT_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes en endpoint sensible',
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: 'Has excedido el límite de solicitudes en este endpoint. Intenta de nuevo en 5 minutos.',
      retryAfter: Math.ceil(5 * 60 / 1000)
    });
  }
});

// Slow down para prevenir ataques de fuerza bruta
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 50, // después de 50 requests
  delayMs: 500, // agregar 500ms de delay por request
  maxDelayMs: 20000, // máximo 20 segundos de delay
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes',
      code: 'SPEED_LIMIT_EXCEEDED',
      message: 'Has enviado demasiadas solicitudes. Las siguientes solicitudes serán más lentas.',
      delayMs: 500
    });
  }
});

// Configuración de Helmet para headers de seguridad
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  xssFilter: true,
  hidePoweredBy: true
};

// Sanitización de datos de entrada
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitizar body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Eliminar caracteres peligrosos
          req.body[key] = req.body[key]
            .replace(/[<>]/g, '') // Eliminar < >
            .replace(/javascript:/gi, '') // Eliminar javascript:
            .replace(/on\w+=/gi, '') // Eliminar event handlers
            .trim();
        }
      });
    }

    // Sanitizar query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key]
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
        }
      });
    }

    // Sanitizar params
    if (req.params) {
      Object.keys(req.params).forEach(key => {
        if (typeof req.params[key] === 'string') {
          req.params[key] = req.params[key]
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
        }
      });
    }

    next();
  } catch (error) {
    console.error('Error sanitizando input:', error);
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      code: 'INPUT_SANITIZATION_ERROR'
    });
  }
};

// Validación de tamaño de payload
const validatePayloadSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = parseSize(maxSize);
    
    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: 'Payload demasiado grande',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize,
        currentSize: formatBytes(contentLength)
      });
    }
    
    next();
  };
};

// Función auxiliar para convertir tamaño a bytes
function parseSize(size) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return value * units[unit];
}

// Función auxiliar para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Middleware de logging de seguridad
const securityLogger = (req, res, next) => {
  const securityInfo = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
    origin: req.headers.origin,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  };

  // Log de seguridad para requests sospechosos
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS
    /javascript:/i, // JavaScript injection
    /on\w+=/i, // Event handlers
    /union\s+select/i, // SQL injection
    /exec\s*\(/i, // Command injection
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.originalUrl) || 
    pattern.test(JSON.stringify(req.body)) ||
    pattern.test(JSON.stringify(req.query))
  );

  if (isSuspicious) {
    console.warn(`🚨 [SECURITY] Request sospechoso detectado:`, securityInfo);
    
    // Registrar en base de datos para análisis
    try {
      const database = require('../database/connection');
      database.run(
        'INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [
          null,
          'SUSPICIOUS_REQUEST',
          securityInfo.ip,
          securityInfo.userAgent,
          JSON.stringify(securityInfo)
        ]
      );
    } catch (error) {
      console.error('Error registrando request sospechoso:', error);
    }
  }

  next();
};

// Middleware de protección contra ataques de timing
const timingAttackProtection = (req, res, next) => {
  const startTime = Date.now();
  
  // Agregar delay aleatorio para prevenir timing attacks
  const randomDelay = Math.random() * 100; // 0-100ms
  
  setTimeout(() => {
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      // Log de timing para análisis de seguridad
      if (responseTime > 5000) { // Más de 5 segundos
        console.warn(`⏱️ [SECURITY] Response lento detectado: ${responseTime}ms - ${req.method} ${req.originalUrl}`);
      }
    });
    
    next();
  }, randomDelay);
};

module.exports = {
  corsOptions,
  rateLimiter,
  strictRateLimiter,
  speedLimiter,
  helmetConfig,
  sanitizeInput,
  validatePayloadSize,
  securityLogger,
  timingAttackProtection
};
