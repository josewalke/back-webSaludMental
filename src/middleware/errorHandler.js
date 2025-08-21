const database = require('../database/connection');

/**
 * Middleware de manejo de errores
 * Captura todos los errores y los formatea de manera consistente
 */
const errorHandler = async (err, req, res, next) => {
  // Log del error
  console.error('🚨 Error capturado:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous'
  });

  // Determinar el tipo de error y el código de estado
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let userMessage = 'Error interno del servidor';

  // Errores de validación (Joi, express-validator)
  if (err.name === 'ValidationError' || err.isJoi) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    userMessage = 'Datos de entrada inválidos';
  }

  // Errores de base de datos SQLite
  else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    userMessage = 'El recurso ya existe';
  }
  else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    statusCode = 400;
    errorCode = 'FOREIGN_KEY_VIOLATION';
    userMessage = 'Referencia inválida';
  }
  else if (err.code === 'SQLITE_ERROR') {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    userMessage = 'Error de base de datos';
  }

  // Errores de autenticación
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    userMessage = 'Token de autenticación inválido';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    userMessage = 'Token de autenticación expirado';
  }

  // Errores de permisos
  else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    userMessage = 'No tienes permisos para acceder a este recurso';
  }
  else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    userMessage = 'Acceso denegado';
  }

  // Errores de archivo
  else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    userMessage = 'El archivo es demasiado grande';
  }
  else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorCode = 'UNEXPECTED_FILE';
    userMessage = 'Archivo inesperado en la solicitud';
  }

  // Errores de rate limiting
  else if (err.status === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    userMessage = 'Demasiadas solicitudes, intenta de nuevo más tarde';
  }

  // Errores de sintaxis JSON
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    userMessage = 'JSON inválido en el cuerpo de la solicitud';
  }

  // Errores de timeout
  else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    userMessage = 'La solicitud tardó demasiado en procesarse';
  }

  // Errores de conexión
  else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    userMessage = 'Servicio temporalmente no disponible';
  }

  // Errores personalizados
  else if (err.statusCode) {
    statusCode = err.statusCode;
    errorCode = err.errorCode || 'CUSTOM_ERROR';
    userMessage = err.message || 'Error personalizado';
  }

  // Construir respuesta de error
  const errorResponse = {
    error: {
      code: errorCode,
      message: userMessage,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      requestId: req.id || 'unknown'
    }
  };

  // En desarrollo, incluir detalles adicionales
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      originalMessage: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    };
  }

  // Registrar error en auditoría si es posible
  try {
    if (database.isReady()) {
      await database.run(`
        INSERT INTO audit_logs (user_id, action, resource, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        req.user?.id || null,
        'ERROR',
        'SYSTEM',
        JSON.stringify({
          errorCode,
          message: err.message,
          stack: err.stack,
          url: req.originalUrl,
          method: req.method
        }),
        req.ip,
        req.get('User-Agent')
      ]);
    }
  } catch (auditError) {
    console.error('Error registrando error en auditoría:', auditError);
  }

  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para capturar errores asíncronos
 * Envuelve las funciones async para capturar errores no manejados
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para manejar errores de 404
 * Debe ir después de todas las rutas
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      requestId: req.id || 'unknown'
    }
  });
};

/**
 * Middleware para manejar errores de métodos HTTP no permitidos
 */
const methodNotAllowedHandler = (req, res) => {
  res.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `Método ${req.method} no permitido para esta ruta`,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      requestId: req.id || 'unknown'
    }
  });
};

/**
 * Middleware para manejar errores de validación
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError' || err.isJoi) {
    const validationErrors = [];
    
    if (err.details) {
      // Errores de Joi
      err.details.forEach(detail => {
        validationErrors.push({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        });
      });
    } else if (err.errors) {
      // Errores de express-validator
      err.errors.forEach(error => {
        validationErrors.push({
          field: error.param,
          message: error.msg,
          value: error.value
        });
      });
    }

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        timestamp: new Date().toISOString(),
        details: validationErrors,
        requestId: req.id || 'unknown'
      }
    });
  }

  next(err);
};

/**
 * Middleware para manejar errores de base de datos
 */
const databaseErrorHandler = (err, req, res, next) => {
  if (err.code && err.code.startsWith('SQLITE_')) {
    console.error('Error de base de datos:', err);
    
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error interno de base de datos',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown'
      }
    });
  }

  next(err);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  methodNotAllowedHandler,
  validationErrorHandler,
  databaseErrorHandler
};
