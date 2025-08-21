const cors = require('cors');
const rateLimit = require('express-rate-limit');

/**
 * Middleware de Seguridad Simplificado
 * Solo lo esencial para funcionar en desarrollo
 */

// CORS simple - permitir todo en desarrollo
const corsOptions = {
  origin: true, // Permitir todos los orígenes
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate limiting básico
const basicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP (muy permisivo)
  message: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos'
});

// Rate limiting para cuestionarios
const questionnaireRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: 'Demasiadas solicitudes de cuestionarios'
});

module.exports = {
  corsOptions,
  basicRateLimiter,
  questionnaireRateLimiter
};
