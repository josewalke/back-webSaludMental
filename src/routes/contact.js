const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { body, validationResult } = require('express-validator');

/**
 * POST /api/contact
 * Crear un nuevo mensaje de contacto
 */
router.post('/', [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('asunto').optional().trim().isLength({ max: 200 }).withMessage('El asunto no puede exceder 200 caracteres'),
  body('mensaje').trim().isLength({ min: 10, max: 2000 }).withMessage('El mensaje debe tener entre 10 y 2000 caracteres')
], async (req, res) => {
  try {
    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { nombre, email, asunto, mensaje } = req.body;

    // Crear mensaje en la base de datos
    const messageId = await ContactMessage.create({
      nombre,
      email,
      asunto: asunto || 'Sin asunto',
      mensaje
    });

    console.log('✅ Mensaje de contacto creado exitosamente:', messageId);

    res.status(201).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: { id: messageId }
    });

  } catch (error) {
    console.error('❌ Error en endpoint de contacto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/contact/stats
 * Obtener estadísticas de mensajes (público)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await ContactMessage.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de contacto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;

