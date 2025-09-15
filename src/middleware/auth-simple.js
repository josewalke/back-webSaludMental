const jwt = require('jsonwebtoken');

/**
 * Middleware de Autenticación Simplificado
 * Solo lo esencial para funcionar
 */

// Configuración segura
const JWT_SECRET = process.env.JWT_SECRET || '5e6a1605bc63e86ae63583921f8ae329844697ab555df835d241ad0a694fddbb695b17459e83325ac14e8b10cd55702fb4123f24e92317af3f3b288a3ae0ce42';

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
    // Solo mostrar logs en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Verificando token:', token.substring(0, 20) + '...');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Token válido:', decoded);
    }
    
    return decoded;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error verificando token:', error.message);
    }
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
