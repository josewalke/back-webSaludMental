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
// OBTENER TODOS LOS CUESTIONARIOS (SIN FILTRO DE USUARIO)
// ========================================
router.get('/questionnaires', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📊 OBTENIENDO TODOS LOS CUESTIONARIOS (ADMIN)');
    
    // Usar la base de datos configurada (PostgreSQL en producción)
    const database = require('../config/database');
    
    // Obtener TODOS los cuestionarios sin filtrar por usuario
    const query = `
      SELECT 
        q.id,
        q.type,
        q.personal_info,
        q.answers,
        q.status,
        q.created_at,
        u.email as user_email,
        u.name as user_name
      FROM questionnaires q
      LEFT JOIN users u ON q.user_id = u.id
      ORDER BY q.created_at DESC
    `;
    
    const result = await database.query(query);
    const questionnaires = result.rows || [];
    
    console.log(`📊 Total de cuestionarios encontrados: ${questionnaires.length}`);
    
    // Procesar cada cuestionario
    const processedQuestionnaires = questionnaires.map(q => {
      let personalInfo = {};
      let answers = {};
      
      // 🔍 DEBUG: Log detallado de lo que viene de la BD
      console.log(`🔍 DEBUG Cuestionario ID ${q.id}:`);
      console.log(`   - answers (raw):`, q.answers);
      console.log(`   - answers type:`, typeof q.answers);
      console.log(`   - answers length:`, q.answers ? q.answers.length : 'N/A');
      
      try {
        personalInfo = JSON.parse(q.personal_info || '{}');
        answers = JSON.parse(q.answers || '{}');
        
        // 🔍 DEBUG: Log después del parse
        console.log(`   ✅ Parse exitoso:`);
        console.log(`      - personalInfo:`, personalInfo);
        console.log(`      - answers:`, answers);
        console.log(`      - answers keys:`, Object.keys(answers));
        
      } catch (e) {
        console.warn('⚠️ Error parseando JSON para ID', q.id, ':', e.message);
        console.error('❌ DEBUG: Contenido problemático:', {
          personal_info: q.personal_info,
          answers: q.answers,
          error: e.message
        });
        personalInfo = { nombre: 'Usuario', apellidos: 'Desconocido' };
        answers = { error: 'Error parseando respuestas' };
      }
      
      return {
        id: q.id,
        type: q.type,
        status: q.status,
        personalInfo: personalInfo,
        answers: answers,
        userEmail: q.user_email,
        userName: q.user_name,
        createdAt: q.created_at
      };
    });
    
    // Separar por tipo
    const parejaQuestionnaires = processedQuestionnaires.filter(q => q.type === 'pareja');
    const personalidadQuestionnaires = processedQuestionnaires.filter(q => q.type === 'personalidad');
    
    const response = {
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
      total: response.total,
      pareja: response.pareja.count,
      personalidad: response.personalidad.count
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error obteniendo cuestionarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ========================================
// LIMPIAR DATOS CORRUPTOS
// ========================================
router.delete('/clean-corrupted-data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🧹 ADMIN SOLICITANDO LIMPIEZA DE DATOS CORRUPTOS');
    
    const database = require('../config/database');
    
    // 1. Verificar cuestionarios existentes
    const questionnaires = await database.query('SELECT id, answers FROM questionnaires');
    console.log(`📊 Total cuestionarios encontrados: ${questionnaires.rows.length}`);
    
    // 2. Identificar cuestionarios corruptos
    const corruptedIds = [];
    questionnaires.rows.forEach(row => {
      try {
        const answers = JSON.parse(row.answers);
        // Verificar si alguna respuesta contiene [object Object]
        const hasCorruptedData = Object.values(answers).some(answer => 
          String(answer).includes('[object Object]')
        );
        if (hasCorruptedData) {
          corruptedIds.push(row.id);
          console.log(`❌ Cuestionario ${row.id} tiene datos corruptos`);
        }
      } catch (error) {
        corruptedIds.push(row.id);
        console.log(`❌ Cuestionario ${row.id} tiene JSON inválido`);
      }
    });
    
    if (corruptedIds.length === 0) {
      console.log('✅ No se encontraron cuestionarios corruptos');
      return res.json({
        success: true,
        message: 'No se encontraron cuestionarios corruptos',
        deleted: 0
      });
    }
    
    console.log(`🗑️ Cuestionarios a eliminar: ${corruptedIds.join(', ')}`);
    
    // 3. Eliminar cuestionarios corruptos
    let deletedCount = 0;
    for (const id of corruptedIds) {
      await database.query('DELETE FROM questionnaires WHERE id = $1', [id]);
      deletedCount++;
      console.log(`✅ Cuestionario ${id} eliminado`);
    }
    
    // 4. Verificar resultado
    const remainingQuestionnaires = await database.query('SELECT COUNT(*) as count FROM questionnaires');
    console.log(`📊 Cuestionarios restantes: ${remainingQuestionnaires.rows[0].count}`);
    
    console.log('🎉 ¡Limpieza completada exitosamente!');
    
    res.json({
      success: true,
      message: 'Limpieza completada exitosamente',
      deleted: deletedCount,
      remaining: parseInt(remainingQuestionnaires.rows[0].count)
    });
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ========================================
// ELIMINAR CUESTIONARIO INDIVIDUAL
// ========================================
router.delete('/questionnaires/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ ADMIN SOLICITANDO ELIMINAR CUESTIONARIO ID: ${id}`);
    
    const database = require('../config/database');
    
    // 1. Verificar que el cuestionario existe
    const existingQuestionnaire = await database.query(
      'SELECT id, type, email FROM questionnaires WHERE id = $1',
      [id]
    );
    
    if (existingQuestionnaire.rows.length === 0) {
      console.log(`❌ Cuestionario ${id} no encontrado`);
      return res.status(404).json({
        success: false,
        message: 'Cuestionario no encontrado'
      });
    }
    
    const questionnaire = existingQuestionnaire.rows[0];
    console.log(`📝 Cuestionario a eliminar: ID ${id}, Tipo: ${questionnaire.type}, Email: ${questionnaire.email}`);
    
    // 2. Eliminar el cuestionario
    await database.query('DELETE FROM questionnaires WHERE id = $1', [id]);
    console.log(`✅ Cuestionario ${id} eliminado exitosamente`);
    
    // 3. Verificar resultado
    const remainingQuestionnaires = await database.query('SELECT COUNT(*) as count FROM questionnaires');
    console.log(`📊 Cuestionarios restantes: ${remainingQuestionnaires.rows[0].count}`);
    
    res.json({
      success: true,
      message: 'Cuestionario eliminado exitosamente',
      deletedId: parseInt(id),
      remaining: parseInt(remainingQuestionnaires.rows[0].count)
    });
    
  } catch (error) {
    console.error('❌ Error eliminando cuestionario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ========================================
// DEBUG PÚBLICO - VER ESTADO DE LA BD
// ========================================
router.get('/debug/database-status', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verificando estado de la base de datos...');
    
    const database = require('../config/database');
    
    // 1. Verificar conexión
    const connectionTest = await database.query('SELECT 1 as test, NOW() as timestamp');
    console.log('✅ Conexión a BD exitosa');
    
    // 2. Verificar tablas existentes
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tables = await database.query(tablesQuery);
    console.log('📋 Tablas encontradas:', tables.rows.map(t => t.table_name));
    
    // 3. Verificar usuarios
    let usersCount = 0;
    let adminUser = null;
    try {
      const usersResult = await database.query('SELECT COUNT(*) as count FROM users');
      usersCount = parseInt(usersResult.rows[0].count);
      
      if (usersCount > 0) {
        const adminResult = await database.query('SELECT id, email, role FROM users WHERE role = $1', ['admin']);
        if (adminResult.rows.length > 0) {
          adminUser = adminResult.rows[0];
        }
      }
    } catch (error) {
      console.log('⚠️ Error verificando usuarios:', error.message);
    }
    
    // 4. Verificar cuestionarios
    let questionnairesCount = 0;
    let questionnairesSample = [];
    let corruptedCount = 0;
    
    try {
      const questionnairesResult = await database.query('SELECT COUNT(*) as count FROM questionnaires');
      questionnairesCount = parseInt(questionnairesResult.rows[0].count);
      
      if (questionnairesCount > 0) {
        // Obtener muestra de cuestionarios
        const sampleResult = await database.query(`
          SELECT id, type, email, status, created_at, 
                 CASE 
                   WHEN answers IS NULL THEN 'NULL'
                   WHEN answers = '' THEN 'EMPTY'
                   WHEN answers = '{}' THEN 'EMPTY_OBJECT'
                   ELSE 'HAS_DATA'
                 END as answers_status,
                 LEFT(answers::text, 100) as answers_preview
          FROM questionnaires 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        questionnairesSample = sampleResult.rows;
        
        // Verificar cuestionarios corruptos
        const allQuestionnaires = await database.query('SELECT id, answers FROM questionnaires');
        allQuestionnaires.rows.forEach(row => {
          try {
            if (row.answers && row.answers !== '{}' && row.answers !== '') {
              const parsed = JSON.parse(row.answers);
              if (typeof parsed === 'object' && parsed !== null) {
                const hasCorruptedData = Object.values(parsed).some(answer => 
                  String(answer).includes('[object Object]')
                );
                if (hasCorruptedData) {
                  corruptedCount++;
                }
              }
            }
          } catch (error) {
            corruptedCount++;
          }
        });
      }
    } catch (error) {
      console.log('⚠️ Error verificando cuestionarios:', error.message);
    }
    
    // 5. Resumen del estado
    const status = {
      timestamp: new Date().toISOString(),
      database: {
        connection: 'OK',
        tables: tables.rows.map(t => t.table_name)
      },
      users: {
        total: usersCount,
        admin: adminUser ? { id: adminUser.id, email: adminUser.email } : null
      },
      questionnaires: {
        total: questionnairesCount,
        corrupted: corruptedCount,
        healthy: questionnairesCount - corruptedCount,
        sample: questionnairesSample
      },
      recommendations: []
    };
    
    // Agregar recomendaciones
    if (corruptedCount > 0) {
      status.recommendations.push(`Limpiar ${corruptedCount} cuestionarios corruptos`);
    }
    if (questionnairesCount === 0) {
      status.recommendations.push('No hay cuestionarios. Crear algunos para probar');
    }
    if (usersCount === 0) {
      status.recommendations.push('No hay usuarios. Ejecutar seed-data');
    }
    
    console.log('📊 Estado de BD:', {
      usuarios: usersCount,
      cuestionarios: questionnairesCount,
      corruptos: corruptedCount
    });
    
    res.json({
      success: true,
      message: 'Estado de la base de datos',
      data: status
    });
    
  } catch (error) {
    console.error('❌ Error en debug de BD:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
