require('dotenv').config();

// Script para ejecutar migración en producción
// Este script se conecta directamente a la base de datos de producción

const { Pool } = require('pg');

const runProductionMigration = async () => {
  console.log('🚀 Iniciando migración de producción...');
  
  // Conectar a la base de datos de producción
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    // Verificar conexión
    console.log('🔌 Conectando a la base de datos de producción...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión establecida');

    // Crear tabla contact_messages si no existe
    console.log('📝 Creando tabla contact_messages...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        asunto VARCHAR(200),
        mensaje TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear índices si no existen
    console.log('📊 Creando índices...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at)`);

    // Verificar que la tabla se creó correctamente
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contact_messages'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Tabla contact_messages creada exitosamente');
    } else {
      throw new Error('❌ Error: La tabla contact_messages no se creó');
    }

    // Mostrar estadísticas
    const countResult = await pool.query('SELECT COUNT(*) FROM contact_messages');
    console.log(`📊 Mensajes de contacto en la base de datos: ${countResult.rows[0].count}`);

    console.log('🎉 Migración de producción completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en la migración de producción:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Ejecutar migración
runProductionMigration()
  .then(() => {
    console.log('✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
