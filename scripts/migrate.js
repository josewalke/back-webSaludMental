require('dotenv').config();
const pool = require('../src/config/database');

const createTables = async () => {
  console.log('🚀 Iniciando migración de base de datos...');
  
  try {
    // Crear tabla de usuarios
    console.log('📝 Creando tabla users...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de cuestionarios
    console.log('📝 Creando tabla questionnaires...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questionnaires (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        email VARCHAR(255),
        type VARCHAR(100) NOT NULL DEFAULT 'personality',
        answers JSONB NOT NULL,
        personal_info JSONB,
        compatibility_results JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Crear tabla de análisis de compatibilidad
    console.log('📝 Creando tabla compatibility_analysis...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compatibility_analysis (
        id SERIAL PRIMARY KEY,
        questionnaire1_id INTEGER NOT NULL,
        questionnaire2_id INTEGER NOT NULL,
        compatibility_score DECIMAL(5,2),
        detailed_analysis JSONB,
        recommendations JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (questionnaire1_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        FOREIGN KEY (questionnaire2_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      );
    `);

    // Crear índices para mejor performance
    console.log('📊 Creando índices...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_questionnaires_user_id ON questionnaires(user_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_questionnaires_email ON questionnaires(email);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_questionnaires_type ON questionnaires(type);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_questionnaires_created_at ON questionnaires(created_at);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_compatibility_questionnaire1 ON compatibility_analysis(questionnaire1_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_compatibility_questionnaire2 ON compatibility_analysis(questionnaire2_id);
    `);

    // Crear usuario admin por defecto (si no existe)
    console.log('👤 Creando usuario admin por defecto...');
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (email, password, name, role)
      VALUES ($1, $2, 'Administrador', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, ['admin@websaludmental.com', adminPassword]);

    console.log('✅ Migración completada exitosamente!');
    console.log('📊 Tablas creadas:');
    console.log('   - users');
    console.log('   - questionnaires'); 
    console.log('   - compatibility_analysis');
    console.log('👤 Usuario admin creado: admin@websaludmental.com / admin123');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
};

// Función para verificar conexión
const testConnection = async () => {
  try {
    // Usar una consulta compatible con ambas bases de datos
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      // PostgreSQL
      const result = await pool.query('SELECT NOW() as current_time');
      console.log('🔗 Conexión exitosa a PostgreSQL');
      console.log('⏰ Hora del servidor:', result.rows[0].current_time);
    } else {
      // SQLite
      const result = await pool.query('SELECT datetime("now") as current_time');
      console.log('🔗 Conexión exitosa a SQLite');
      console.log('⏰ Hora del servidor:', result.rows[0].current_time);
    }
    return true;
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return false;
  }
};

// Ejecutar migración
const runMigration = async () => {
  console.log('🐘 Configurando base de datos para Web Salud Mental...');
  
  // Verificar conexión primero
  const connected = await testConnection();
  if (!connected) {
    console.error('💥 No se pudo conectar a la base de datos');
    process.exit(1);
  }

  // Ejecutar migración
  try {
    await createTables();
    console.log('🎉 ¡Migración completada con éxito!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Error en migración:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigration();
}

module.exports = { createTables, testConnection };
