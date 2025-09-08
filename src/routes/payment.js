const express = require('express');
const router = express.Router();
const paymentConfig = require('../config/payment');

/**
 * GET /api/payment/status
 * Verifica el estado del pago del proyecto
 */
router.get('/status', (req, res) => {
  try {
    // Actualizar timestamp
    const paymentStatus = {
      ...paymentConfig,
      lastUpdated: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      // Información adicional de seguridad
      checksum: generateChecksum(paymentConfig),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      data: paymentStatus,
      message: paymentStatus.isPaid ? 'Pago verificado' : 'Pago pendiente'
    });
  } catch (error) {
    console.error('Error verificando estado de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'No se pudo verificar el estado del pago'
    });
  }
});

/**
 * POST /api/payment/update
 * Actualiza el estado del pago (sin contraseña)
 */
router.post('/update', (req, res) => {
  try {
    const { isPaid } = req.body;
    
    // Actualizar configuración sin verificación de contraseña
    paymentConfig.isPaid = Boolean(isPaid);
    paymentConfig.lastUpdated = new Date().toISOString();
    
    console.log(`🔒 Estado de pago actualizado: ${paymentConfig.isPaid ? 'PAGADO' : 'PENDIENTE'}`);
    
    res.json({
      success: true,
      data: {
        isPaid: paymentConfig.isPaid,
        lastUpdated: paymentConfig.lastUpdated,
        message: paymentConfig.isPaid ? 'Pago confirmado' : 'Pago marcado como pendiente'
      },
      message: 'Estado de pago actualizado correctamente'
    });
  } catch (error) {
    console.error('Error actualizando estado de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar el estado del pago'
    });
  }
});

/**
 * GET /api/payment/info
 * Obtiene información detallada del proyecto
 */
router.get('/info', (req, res) => {
  try {
    const projectInfo = {
      projectName: paymentConfig.projectName,
      amount: paymentConfig.amount,
      dueDate: paymentConfig.dueDate,
      developer: paymentConfig.developer,
      email: paymentConfig.email,
      linkedin: paymentConfig.linkedin,
      github: paymentConfig.github,
      lastUpdated: paymentConfig.lastUpdated,
      version: paymentConfig.version
    };
    
    res.json({
      success: true,
      data: projectInfo,
      message: 'Información del proyecto obtenida'
    });
  } catch (error) {
    console.error('Error obteniendo información del proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la información del proyecto'
    });
  }
});

/**
 * Función para generar checksum de seguridad
 */
function generateChecksum(config) {
  const crypto = require('crypto');
  const data = `${config.isPaid}-${config.amount}-${config.projectName}-${config.lastUpdated}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = router;
