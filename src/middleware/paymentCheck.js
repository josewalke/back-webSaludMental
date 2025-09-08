const paymentConfig = require('../config/payment');

/**
 * Middleware para verificar el estado del pago
 * Bloquea el acceso a rutas protegidas si el pago no está completo
 */
const paymentCheck = (req, res, next) => {
  try {
    // Verificar si el pago está completo
    if (!paymentConfig.isPaid) {
      console.log(`🔒 Acceso bloqueado a ${req.path} - Pago pendiente`);
      
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: 'El pago del proyecto está pendiente',
        data: {
          isPaid: false,
          amount: paymentConfig.amount,
          dueDate: paymentConfig.dueDate,
          projectName: paymentConfig.projectName,
          developer: paymentConfig.developer,
          email: paymentConfig.email,
          linkedin: paymentConfig.linkedin,
          github: paymentConfig.github,
          lastUpdated: paymentConfig.lastUpdated
        }
      });
    }
    
    // Si el pago está completo, continuar
    console.log(`✅ Acceso permitido a ${req.path} - Pago verificado`);
    next();
  } catch (error) {
    console.error('Error en middleware de verificación de pago:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error verificando estado de pago'
    });
  }
};

/**
 * Middleware opcional para rutas que pueden funcionar sin pago
 * Pero que muestran información adicional si el pago está pendiente
 */
const paymentInfo = (req, res, next) => {
  try {
    // Agregar información de pago al request
    req.paymentInfo = {
      isPaid: paymentConfig.isPaid,
      amount: paymentConfig.amount,
      dueDate: paymentConfig.dueDate,
      projectName: paymentConfig.projectName,
      developer: paymentConfig.developer,
      email: paymentConfig.email,
      linkedin: paymentConfig.linkedin,
      github: paymentConfig.github,
      lastUpdated: paymentConfig.lastUpdated
    };
    
    next();
  } catch (error) {
    console.error('Error en middleware de información de pago:', error);
    next();
  }
};

module.exports = {
  paymentCheck,
  paymentInfo
};