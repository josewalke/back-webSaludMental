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
    try {
      await database.query('SELECT 1 as test');
      dbStatus = 'connected';
    } catch (dbError) {
      dbStatus = 'error';
    }
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      database: dbStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error checking health status'
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
