const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth-simple');
const User = require('../models/User');

// Middleware para verificar que sea admin
const requireAdmin = requireRole('admin');

// ========================================
// LOGIN ADMIN
// ========================================
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 INTENTO DE LOGIN ADMIN:', { email: req.body.email });
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email
    const user = await User.findByEmail(email);
    
    console.log('🔍 Usuario encontrado:', {
      id: user?.id,
      email: user?.email,
      role: user?.role
    });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que sea admin
    if (user.role !== 'admin') {
      console.log('❌ No es admin, role:', user.role);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores.'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const { generateToken } = require('../middleware/auth-simple');
    const accessToken = generateToken(user.id, user.role);

    console.log('✅ LOGIN ADMIN EXITOSO:', { userId: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Login admin exitoso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        accessToken
      }
    });

  } catch (error) {
    console.error('❌ Error en login admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ========================================
// PERFIL ADMIN
// ========================================
router.get('/profile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('👤 OBTENIENDO PERFIL ADMIN:', { userId: req.user.userId });
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo perfil admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ========================================
// OBTENER CUESTIONARIOS REALES DE LA BASE DE DATOS
// ========================================
router.get('/questionnaires', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📊 OBTENIENDO CUESTIONARIOS REALES DE LA BASE DE DATOS');
    
    // Importar la base de datos DIRECTAMENTE
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const dbPath = path.join(__dirname, '../../database.sqlite');
    
    console.log('🔌 Conectando directamente a:', dbPath);
    
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error conectando a la base de datos:', err);
      } else {
        console.log('✅ Conectado directamente a la base de datos');
      }
    });
    
    // CONSULTA SUPER SIMPLE Y RÁPIDA
    console.log('🔍 Ejecutando consulta SQL SIMPLE...');
    
    // Primero contar cuántos hay (consulta rápida)
    const countQuery = `SELECT COUNT(*) as total FROM questionnaires WHERE completed = 1`;
    
    const countResult = await new Promise((resolve, reject) => {
      database.get(countQuery, (err, row) => {
        if (err) {
          console.error('❌ Error contando cuestionarios:', err);
          reject(err);
        } else {
          resolve(row?.total || 0);
        }
      });
    });
    
    console.log(`📊 Total de cuestionarios completados: ${countResult}`);
    
    if (countResult === 0) {
      console.log('✅ No hay cuestionarios, devolviendo lista vacía');
      database.close();
      return res.json({
        success: true,
        total: 0,
        pareja: { count: 0, questionnaires: [] },
        personalidad: { count: 0, questionnaires: [] }
      });
    }
    
    // Si hay cuestionarios, obtener TODOS (sin límite)
    const simpleQuery = `
      SELECT id, type, personal_info, answers, completed_at, created_at
      FROM questionnaires 
      WHERE completed = 1
      ORDER BY id DESC
    `;
    
    // Definir las preguntas del cuestionario de pareja (IDs empiezan en 0)
    const parejaQuestions = [
      "¿Qué buscas principalmente en una relación?",
      "¿Cómo prefieres pasar tiempo con tu pareja?",
      "¿Qué valoras más en una persona?",
      "¿Cómo manejas los conflictos en una relación?",
      "¿Qué te gustaría mejorar en ti mismo para una relación?",
      "¿Qué tan importante es la comunicación en una relación para ti?",
      "¿Cómo te sientes cuando tu pareja necesita espacio personal?",
      "¿Qué tan importante es la confianza en una relación?",
      "¿Cómo reaccionas cuando tu pareja tiene éxito?",
      "¿Qué tan importante es la compatibilidad sexual?",
      "¿Cómo manejas los celos en una relación?",
      "¿Qué tan importante es compartir valores en una relación?",
      "¿Cómo te sientes cuando tu pareja tiene amigos del sexo opuesto?",
      "¿Qué tan importante es la independencia financiera en una relación?",
      "¿Cómo manejas las diferencias de opinión con tu pareja?",
      "¿Qué tan importante es la compatibilidad de horarios y estilo de vida?",
      "¿Cómo te gustaría que sea tu relación ideal?"
    ];
    
    const questionnaires = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ Timeout alcanzado, devolviendo datos limitados');
        resolve([]); // No fallar, devolver lista vacía
      }, 3000); // Solo 3 segundos
      
      database.all(simpleQuery, (err, rows) => {
        clearTimeout(timeout);
        
        if (err) {
          console.error('❌ Error en consulta SQL:', err);
          resolve([]); // No fallar, devolver lista vacía
        } else {
          console.log(`📊 Consulta completada. Filas obtenidas: ${rows?.length || 0}`);
          
          const results = (rows || []).map(row => {
            let personalInfo = {};
            let answers = {};
            
            try {
              personalInfo = JSON.parse(row.personal_info || '{}');
              answers = JSON.parse(row.answers || '{}');
            } catch (e) {
              console.warn('⚠️ Error parseando JSON para ID', row.id, ':', e.message);
              personalInfo = { nombre: 'Usuario', apellidos: 'Desconocido' };
              answers = { error: 'Error parseando respuestas' };
            }
            
            // Agregar las preguntas reales si es cuestionario de pareja
            let questionsWithAnswers = {};
            if (row.type === 'pareja') {
              Object.entries(answers).forEach(([questionId, answer]) => {
                const questionNumber = parseInt(questionId);
                if (questionNumber >= 0 && questionNumber < parejaQuestions.length) {
                  questionsWithAnswers[questionId] = {
                    question: parejaQuestions[questionNumber],
                    answer: answer
                  };
                } else {
                  questionsWithAnswers[questionId] = {
                    question: `Pregunta ${questionNumber + 1}`,
                    answer: answer
                  };
                }
              });
            } else {
              // Para otros tipos de cuestionarios, mantener formato original
              questionsWithAnswers = answers;
            }
            
            // Manejar fechas correctamente
            let completedAt = row.completed_at;
            if (!completedAt || completedAt === '') {
              completedAt = row.created_at; // Usar created_at si completed_at está vacío
            }
            
            return {
              id: row.id,
              type: row.type,
              personalInfo: personalInfo,
              answers: questionsWithAnswers,
              completed: true,
              completedAt: completedAt,
              createdAt: row.created_at
            };
          });
          
          resolve(results);
        }
      });
    });
    
    // Separar por tipo
    const parejaQuestionnaires = questionnaires.filter(q => q.type === 'pareja');
    const personalidadQuestionnaires = questionnaires.filter(q => q.type === 'personalidad');
    
    const result = {
      success: true,
      total: questionnaires.length,
      pareja: {
        count: parejaQuestionnaires.length,
        questionnaires: parejaQuestionnaires
      },
      personalidad: {
        count: personalidadQuestionnaires.length,
        questionnaires: personalidadQuestionnaires
      }
    };
    
    console.log('✅ Cuestionarios obtenidos exitosamente:', {
      total: result.total,
      pareja: result.pareja.count,
      personalidad: result.pareja.count
    });
    
    res.json(result);
    
    // Cerrar conexión
    database.close();
    
  } catch (error) {
    console.error('❌ Error obteniendo cuestionarios:', error);
    
    // Si hay error, devolver datos vacíos en lugar de fallar
    res.json({
      success: true,
      total: 0,
      pareja: { count: 0, questionnaires: [] },
      personalidad: { count: 0, questionnaires: [] },
      error: error.message
    });
    
    // Cerrar conexión en caso de error
    if (typeof database !== 'undefined' && database) {
      try {
        database.close();
      } catch (e) {
        console.log('⚠️ Error cerrando conexión:', e.message);
      }
    }
  } finally {
    // Asegurar que la conexión se cierre siempre
    if (typeof database !== 'undefined' && database) {
      try {
        database.close();
        console.log('🔌 Conexión cerrada en finally');
      } catch (e) {
        console.log('⚠️ Error cerrando conexión en finally:', e.message);
      }
    }
  }
});

module.exports = router;
