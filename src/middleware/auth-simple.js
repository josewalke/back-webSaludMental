const jwt = require('jsonwebtoken');

/**
 * Middleware de Autenticación Simplificado
 * Solo lo esencial para funcionar
 */

// Configuración simple
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_in_production';

/**
 * Generar token JWT simple
 */
function generateToken(userId, userRole = 'user') {
  return jwt.sign(
    { userId, userRole },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verificar token JWT simple
 */
function verifyToken(token) {
  try {
    console.log('🔍 Verificando token:', token.substring(0, 20) + '...');
    console.log('🔑 JWT_SECRET:', JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token válido:', decoded);
    return decoded;
  } catch (error) {
    console.error('❌ Error verificando token:', error.message);
    throw new Error('Token inválido');
  }
}

/**
 * Middleware para autenticar token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware para requerir rol específico
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user && req.user.userRole === role) {
      next();
    } else {
      res.status(403).json({ error: 'Acceso denegado' });
    }
  };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole
};
