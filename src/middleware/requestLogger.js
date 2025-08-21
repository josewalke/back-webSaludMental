const { v4: uuidv4 } = require('uuid');
const database = require('../database/connection');

/**
 * Middleware para logging detallado de requests
 */
const requestLogger = (req, res, next) => {
  // Generar ID único para el request
  req.id = uuidv4();
  
  // Timestamp de inicio
  req.startTime = Date.now();
  
  // Log del request entrante
  console.log(`📥 [${req.id}] ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  // Interceptar la respuesta para logging
  const originalSend = res.send;
  
  res.send = function(data) {
    // Restaurar función original
    res.send = originalSend;
    
    // Calcular duración del request
    const duration = Date.now() - req.startTime;
    
    // Log de la respuesta
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    console.log(`${statusColor} [${req.id}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    
    // Log detallado en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`   📊 Request ID: ${req.id}`);
      console.log(`   ⏱️  Duración: ${duration}ms`);
      console.log(`   📍 IP: ${req.ip}`);
      console.log(`   🌐 User Agent: ${req.get('User-Agent')}`);
      console.log(`   📝 Status: ${res.statusCode}`);
      console.log(`   📦 Response Size: ${data ? data.length : 0} bytes`);
      
      if (req.user) {
        console.log(`   👤 Usuario: ${req.user.name} (${req.user.id})`);
      }
      
      if (Object.keys(req.body).length > 0) {
        console.log(`   📋 Body:`, JSON.stringify(req.body, null, 2));
      }
    }
    
    // Registrar en auditoría si es posible
    setTimeout(async () => {
      try {
        if (database.isReady()) {
          await database.run(`
            INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            req.user?.id || null,
            'REQUEST',
            req.method,
            null,
            JSON.stringify({
              requestId: req.id,
              path: req.originalUrl,
              statusCode: res.statusCode,
              duration: duration,
              responseSize: data ? data.length : 0,
              timestamp: new Date().toISOString()
            }),
            req.ip,
            req.get('User-Agent')
          ]);
        }
      } catch (auditError) {
        console.error('Error registrando request en auditoría:', auditError);
      }
    }, 0);
    
    // Llamar función original
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware para logging de errores específicos
 */
const errorLogger = (err, req, res, next) => {
  const duration = Date.now() - req.startTime;
  
  console.error(`💥 [${req.id}] ERROR en ${req.method} ${req.originalUrl}:`);
  console.error(`   ⏱️  Duración: ${duration}ms`);
  console.error(`   📍 IP: ${req.ip}`);
  console.error(`   👤 Usuario: ${req.user?.name || 'anonymous'}`);
  console.error(`   🚨 Error: ${err.message}`);
  console.error(`   📚 Stack: ${err.stack}`);
  
  next(err);
};

/**
 * Middleware para logging de requests lentos
 */
const slowRequestLogger = (threshold = 1000) => {
  return (req, res, next) => {
    req.startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      
      if (duration > threshold) {
        console.warn(`🐌 [${req.id}] REQUEST LENTO: ${req.method} ${req.originalUrl} - ${duration}ms`);
        console.warn(`   ⏱️  Duración: ${duration}ms (umbral: ${threshold}ms)`);
        console.warn(`   📍 IP: ${req.ip}`);
        console.warn(`   👤 Usuario: ${req.user?.name || 'anonymous'}`);
        console.warn(`   📝 Status: ${res.statusCode}`);
      }
    });
    
    next();
  };
};

/**
 * Middleware para logging de requests grandes
 */
const largeRequestLogger = (sizeThreshold = 1024 * 1024) => { // 1MB
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > sizeThreshold) {
      console.warn(`📦 [${req.id}] REQUEST GRANDE: ${req.method} ${req.originalUrl}`);
      console.warn(`   📏 Tamaño: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
      console.warn(`   📍 IP: ${req.ip}`);
      console.warn(`   👤 Usuario: ${req.user?.name || 'anonymous'}`);
    }
    
    next();
  };
};

/**
 * Middleware para logging de autenticación
 */
const authLogger = (req, res, next) => {
  if (req.user) {
    console.log(`🔐 [${req.id}] Usuario autenticado: ${req.user.name} (${req.user.role})`);
  } else {
    console.log(`👤 [${req.id}] Usuario anónimo`);
  }
  
  next();
};

module.exports = {
  requestLogger,
  errorLogger,
  slowRequestLogger,
  largeRequestLogger,
  authLogger
};
