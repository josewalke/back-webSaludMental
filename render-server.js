#!/usr/bin/env node

/**
 * Servidor simplificado para Render
 * Evita problemas de configuración compleja
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

// Importar base de datos
const database = require('./src/config/database');

// Importar rutas
const authRoutes = require('./src/routes/auth-simple');
const questionnaireRoutes = require('./src/routes/questionnaires');
const adminRoutes = require('./src/routes/admin');

// Crear aplicación Express
const app = express();

// ========================================
// CONFIGURACIÓN DEL SERVIDOR
// ========================================

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========================================
// MIDDLEWARES BÁSICOS
// ========================================

// Helmet básico
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false
}));

// CORS simplificado
app.use(cors({
  origin: true,
  credentials: true
}));

// Compresión básica
app.use(compression());

// Logging básico
app.use(morgan('combined'));

// Parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================
// RUTAS DE LA API
// ========================================

// Ruta de salud
app.get('/health', async (req, res) => {
  try {
    let dbStatus = 'disconnected';
    let dbInfo = {};
    
    try {
      await database.query('SELECT 1 as test');
      dbStatus = 'connected';
      
      // Obtener información básica de la BD
      try {
        // Verificar tablas
        const tablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        const tables = await database.query(tablesQuery);
        
        // Verificar usuarios
        let usersCount = 0;
        try {
          const usersResult = await database.query('SELECT COUNT(*) as count FROM users');
          usersCount = parseInt(usersResult.rows[0].count);
        } catch (e) {
          usersCount = 0;
        }
        
        // Verificar cuestionarios
        let questionnairesCount = 0;
        try {
          const questionnairesResult = await database.query('SELECT COUNT(*) as count FROM questionnaires');
          questionnairesCount = parseInt(questionnairesResult.rows[0].count);
        } catch (e) {
          questionnairesCount = 0;
        }
        
        dbInfo = {
          tables: tables.rows.map(t => t.table_name),
          users: usersCount,
          questionnaires: questionnairesCount
        };
      } catch (dbInfoError) {
        dbInfo = { error: dbInfoError.message };
      }
      
    } catch (dbError) {
      dbStatus = 'error';
      dbInfo = { error: dbError.message };
    }
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      database: dbStatus,
      dbInfo: dbInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error checking health status'
    });
  }
});

// Ruta de debug simple para verificar BD
app.get('/debug/db-status', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verificando estado de la base de datos...');
    
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
    let corruptedCount = 0;
    
    try {
      const questionnairesResult = await database.query('SELECT COUNT(*) as count FROM questionnaires');
      questionnairesCount = parseInt(questionnairesResult.rows[0].count);
      
      if (questionnairesCount > 0) {
        // Verificar cuestionarios corruptos
        const allQuestionnaires = await database.query('SELECT id, answers FROM questionnaires LIMIT 10');
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
        healthy: questionnairesCount - corruptedCount
      }
    };
    
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

// Ruta de debug para usuarios
app.get('/debug/users', async (req, res) => {
  try {
    console.log('🔍 Debug: Verificando usuarios en la base de datos...');
    
    // Verificar estructura de la tabla users
    const tableInfo = await database.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    // Verificar usuarios existentes
    const users = await database.query('SELECT id, email, name, role, created_at FROM users;');
    
    // Verificar usuario admin específico
    const adminUser = await database.query(
      'SELECT id, email, name, role, created_at FROM users WHERE email = $1',
      ['admin@websaludmental.com']
    );
    
    res.status(200).json({
      debug: true,
      tableStructure: tableInfo.rows,
      totalUsers: users.rows.length,
      users: users.rows,
      adminUser: adminUser.rows[0] || null
    });
    
  } catch (error) {
    console.error('💥 Error en debug:', error);
    res.status(500).json({
      error: 'Error en debug',
      message: error.message
    });
  }
});

// Aplicar rutas
app.use('/api/auth', authRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/admin', adminRoutes);

// Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// ========================================
// INICIALIZACIÓN DEL SERVIDOR
// ========================================

async function startServer() {
  try {
    console.log('🚀 Servidor backend simplificado iniciado exitosamente!');
    console.log(`📍 URL: http://${HOST}:${PORT}`);
    console.log(`🌍 Entorno: ${NODE_ENV}`);
    
    // Iniciar servidor
    app.listen(PORT, HOST, () => {
      console.log(`✅ Servidor escuchando en puerto ${PORT}`);
      console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
    });

  } catch (error) {
    console.error('💥 Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();
