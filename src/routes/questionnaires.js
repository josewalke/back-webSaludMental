const express = require('express');
const router = express.Router();
const Questionnaire = require('../models/Questionnaire');
const User = require('../models/User');

/**
 * POST /api/questionnaires/start
 * Iniciar un nuevo cuestionario
 */
router.post('/start', async (req, res) => {
  try {
    const { type, personalInfo } = req.body;
    
    // Validar tipo de cuestionario
    if (!['pareja', 'personalidad'].includes(type)) {
      return res.status(400).json({
        error: 'Tipo de cuestionario inválido. Debe ser "pareja" o "personalidad"'
      });
    }

    // Validar información personal requerida
    const requiredFields = ['nombre', 'apellidos', 'edad', 'genero', 'correo', 'orientacionSexual'];
    const missingFields = requiredFields.filter(field => !personalInfo[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Campos requeridos faltantes: ${missingFields.join(', ')}`
      });
    }

    // Crear o encontrar usuario por email
    let user = await User.findByEmail(personalInfo.correo);
    
    if (!user) {
      // Crear usuario nuevo
      user = await User.create({
        ...personalInfo,
        password: 'temp_password_' + Date.now() // Contraseña temporal
      });
    }

    // Crear cuestionario
    const questionnaireId = await Questionnaire.create({
      userId: user.id,
      type,
      personalInfo,
      answers: {},
      completed: false
    });

    res.status(201).json({
      success: true,
      message: 'Cuestionario iniciado correctamente',
      data: {
        questionnaireId,
        userId: user.id,
        type,
        personalInfo
      }
    });

  } catch (error) {
    console.error('Error iniciando cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/questionnaires/sync
 * Sincronizar datos del localStorage con el backend
 */
router.post('/sync', async (req, res) => {
  try {
    const { type, personalInfo, answers, completed = false, timestamp } = req.body;
    
    // Log detallado del cuestionario recibido
    console.log(`📥 CUESTIONARIO RECIBIDO EN BACKEND:`);
    console.log(`📋 DATOS DEL USUARIO:`);
    console.log(JSON.stringify({
      tipo: type,
      usuario: {
        nombre: personalInfo.nombre,
        apellidos: personalInfo.apellidos,
        edad: personalInfo.edad,
        genero: personalInfo.genero,
        correo: personalInfo.correo,
        orientacionSexual: personalInfo.orientacionSexual
      },
      cuestionario: {
        totalPreguntas: Object.keys(answers).length,
        completado: completed,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
      },
      backend: 'questionnaires/sync',
      endpoint: '/api/questionnaires/sync'
    }, null, 2));
    
    console.log(`📝 RESPUESTAS RECIBIDAS:`);
    Object.entries(answers).forEach(([questionIndex, answer]) => {
      const questionNumber = parseInt(questionIndex) + 1;
      console.log(`   Pregunta ${questionNumber}: ${answer}`);
    });
    console.log(`📊 ---`);
    
    // Validar datos requeridos
    if (!type || !personalInfo || !personalInfo.correo) {
      return res.status(400).json({
        error: 'Datos requeridos faltantes: type, personalInfo, correo'
      });
    }

    // Crear cuestionario directamente sin crear usuario
    const questionnaireId = await Questionnaire.create({
      userId: null, // No necesitamos usuario
      type,
      personalInfo,
      answers,
      completed
    });
    
    console.log(`🆕 CUESTIONARIO CREADO EXITOSAMENTE:`);
    console.log(JSON.stringify({
      accion: 'creado',
      cuestionarioId: questionnaireId,
      tipo: type,
      estado: 'nuevo',
      timestamp: new Date().toISOString(),
      backend: 'questionnaires/sync'
    }, null, 2));
    
    res.status(201).json({
      success: true,
      message: 'Cuestionario creado y sincronizado',
      data: {
        questionnaireId,
        type,
        personalInfo,
        answers,
        completed,
        timestamp
      }
    });

  } catch (error) {
    console.error('Error sincronizando cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/questionnaires/:id/save
 * Guardar respuestas del cuestionario
 */
router.post('/:id/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, personalInfo, completed = false } = req.body;

    // Buscar cuestionario
    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({
        error: 'Cuestionario no encontrado'
      });
    }

    // Actualizar cuestionario
    const updatedQuestionnaire = await Questionnaire.update(id, questionnaire.userId, {
      answers,
      personalInfo,
      completed
    });

    res.json({
      success: true,
      message: 'Respuestas guardadas correctamente',
      data: updatedQuestionnaire
    });

  } catch (error) {
    console.error('Error guardando respuestas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/questionnaires/:id
 * Obtener cuestionario por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar cuestionario (sin validar usuario por ahora)
    const questionnaire = await Questionnaire.findById(id, null);
    
    if (!questionnaire) {
      return res.status(404).json({
        error: 'Cuestionario no encontrado'
      });
    }

    res.json({
      success: true,
      data: questionnaire
    });

  } catch (error) {
    console.error('Error obteniendo cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/questionnaires/:id/complete
 * Marcar cuestionario como completado
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar cuestionario
    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({
        error: 'Cuestionario no encontrado'
      });
    }

    // Marcar como completado
    const completedQuestionnaire = await Questionnaire.markAsCompleted(id, questionnaire.userId);

    res.json({
      success: true,
      message: 'Cuestionario marcado como completado',
      data: completedQuestionnaire
    });

  } catch (error) {
    console.error('Error completando cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/questionnaires/user/:email
 * Obtener cuestionarios de un usuario por email
 */
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Buscar usuario por email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Obtener cuestionarios del usuario
    const userQuestionnaires = await Questionnaire.findByUser(user.id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          apellidos: user.apellidos,
          correo: user.correo
        },
        questionnaires: userQuestionnaires
      }
    });

  } catch (error) {
    console.error('Error obteniendo cuestionarios del usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/questionnaires/restore/:email/:type
 * Restaurar cuestionario desde localStorage
 */
router.get('/restore/:email/:type', async (req, res) => {
  try {
    const { email, type } = req.params;
    
    // Buscar usuario por email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Buscar cuestionario más reciente del usuario por tipo
    const userQuestionnaires = await Questionnaire.findByUser(user.id, { type, limit: 1 });
    
    if (userQuestionnaires.questionnaires.length === 0) {
      return res.status(404).json({
        error: 'No se encontró cuestionario para restaurar'
      });
    }

    const questionnaire = userQuestionnaires.questionnaires[0];

    res.json({
      success: true,
      message: 'Cuestionario restaurado correctamente',
      data: {
        questionnaireId: questionnaire.id,
        userId: user.id,
        type: questionnaire.type,
        personalInfo: questionnaire.personalInfo,
        answers: questionnaire.answers,
        completed: questionnaire.completed,
        timestamp: questionnaire.updatedAt
      }
    });

  } catch (error) {
    console.error('Error restaurando cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * DELETE /api/questionnaires/:id
 * Eliminar cuestionario
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar cuestionario
    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({
        error: 'Cuestionario no encontrado'
      });
    }

    // Eliminar cuestionario
    const deleted = await Questionnaire.delete(id, questionnaire.userId);

    if (deleted) {
      res.json({
        success: true,
        message: 'Cuestionario eliminado correctamente'
      });
    } else {
      res.status(400).json({
        error: 'No se pudo eliminar el cuestionario'
      });
    }

  } catch (error) {
    console.error('Error eliminando cuestionario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
