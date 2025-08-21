const database = require('./connection');
const path = require('path');

// Esquemas de las tablas
const TABLES = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'professional' CHECK (role IN ('admin', 'professional', 'assistant')),
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  questionnaires: `
    CREATE TABLE IF NOT EXISTS questionnaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('pareja', 'personalidad')),
      personal_info TEXT NOT NULL, -- JSON string
      answers TEXT NOT NULL, -- JSON string
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  
  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id INTEGER,
      details TEXT, -- JSON string
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,
  
  system_config: `
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `,
  
  system_stats: `
    CREATE TABLE IF NOT EXISTS system_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT UNIQUE NOT NULL,
      value REAL NOT NULL,
      metadata TEXT, -- JSON string
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
};

// Índices para mejorar performance
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
  'CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)',
  'CREATE INDEX IF NOT EXISTS idx_questionnaires_user_id ON questionnaires(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_questionnaires_type ON questionnaires(type)',
  'CREATE INDEX IF NOT EXISTS idx_questionnaires_completed ON questionnaires(completed)',
  'CREATE INDEX IF NOT EXISTS idx_questionnaires_created_at ON questionnaires(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key)',
  'CREATE INDEX IF NOT EXISTS idx_system_stats_metric ON system_stats(metric)'
];

// Triggers para actualizar timestamps automáticamente
const TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
   AFTER UPDATE ON users
   BEGIN
     UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END`,
  
  `CREATE TRIGGER IF NOT EXISTS update_questionnaires_updated_at 
   AFTER UPDATE ON questionnaires
   BEGIN
     UPDATE questionnaires SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END`,
  
  `CREATE TRIGGER IF NOT EXISTS update_system_config_updated_at 
   AFTER UPDATE ON system_config
   BEGIN
     UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END`,
  
  `CREATE TRIGGER IF NOT EXISTS update_system_stats_updated_at 
   AFTER UPDATE ON system_stats
   BEGIN
     UPDATE system_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END`
];

// Datos iniciales del sistema
const INITIAL_DATA = {
  system_config: [
    {
      key: 'app_name',
      value: 'Nueva Web Salud Mental',
      description: 'Nombre de la aplicación'
    },
    {
      key: 'app_version',
      value: '1.0.0',
      description: 'Versión actual de la aplicación'
    },
    {
      key: 'max_questionnaires_per_user',
      value: '1000',
      description: 'Máximo número de cuestionarios por usuario'
    },
    {
      key: 'session_timeout_hours',
      value: '24',
      description: 'Tiempo de expiración de sesión en horas'
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      description: 'Modo mantenimiento del sistema'
    }
  ],
  
  system_stats: [
    {
      metric: 'total_users',
      value: 0,
      metadata: JSON.stringify({ description: 'Total de usuarios registrados' })
    },
    {
      metric: 'total_questionnaires',
      value: 0,
      metadata: JSON.stringify({ description: 'Total de cuestionarios creados' })
    },
    {
      metric: 'completed_questionnaires',
      value: 0,
      metadata: JSON.stringify({ description: 'Total de cuestionarios completados' })
    },
    {
      metric: 'completion_rate',
      value: 0.0,
      metadata: JSON.stringify({ description: 'Tasa de completación de cuestionarios' })
    }
  ]
};

/**
 * Inicializar la base de datos
 */
async function initializeDatabase() {
  try {
    console.log('🚀 Iniciando inicialización de la base de datos...');
    
    // Conectar a la base de datos
    await database.connect();
    
    console.log('📋 Creando tablas...');
    
    // Crear tablas
    for (const [tableName, schema] of Object.entries(TABLES)) {
      try {
        await database.run(schema);
        console.log(`✅ Tabla '${tableName}' creada/verificada`);
      } catch (error) {
        console.error(`❌ Error creando tabla '${tableName}':`, error.message);
        throw error;
      }
    }
    
    console.log('🔍 Creando índices...');
    
    // Crear índices
    for (const index of INDEXES) {
      try {
        await database.run(index);
      } catch (error) {
        console.warn(`⚠️ Error creando índice:`, error.message);
      }
    }
    
    console.log('⚡ Creando triggers...');
    
    // Crear triggers
    for (const trigger of TRIGGERS) {
      try {
        await database.run(trigger);
      } catch (error) {
        console.warn(`⚠️ Error creando trigger:`, error.message);
      }
    }
    
    console.log('📊 Insertando datos iniciales...');
    
    // Insertar datos iniciales
    for (const [tableName, data] of Object.entries(INITIAL_DATA)) {
      for (const row of data) {
        try {
          const columns = Object.keys(row).join(', ');
          const placeholders = Object.keys(row).map(() => '?').join(', ');
          const values = Object.values(row);
          
          await database.run(
            `INSERT OR IGNORE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
            values
          );
        } catch (error) {
          console.warn(`⚠️ Error insertando en '${tableName}':`, error.message);
        }
      }
    }
    
    // Verificar estadísticas
    const stats = await database.getStats();
    if (stats) {
      console.log('📈 Estadísticas de la base de datos:');
      console.log(`   - Tablas: ${stats.tables}`);
      console.log(`   - Ruta: ${stats.path}`);
      console.log(`   - Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   - Conteos por tabla:`, stats.tableCounts);
    }
    
    console.log('🎉 Base de datos inicializada exitosamente!');
    
  } catch (error) {
    console.error('💥 Error inicializando la base de datos:', error);
    process.exit(1);
  } finally {
    // Cerrar conexión
    await database.close();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, TABLES, INDEXES, TRIGGERS, INITIAL_DATA };
