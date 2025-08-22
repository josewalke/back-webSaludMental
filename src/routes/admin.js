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
      
      try {
        personalInfo = JSON.parse(q.personal_info || '{}');
        answers = JSON.parse(q.answers || '{}');
      } catch (e) {
        console.warn('⚠️ Error parseando JSON para ID', q.id, ':', e.message);
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

module.exports = router;
