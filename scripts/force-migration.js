// Script para forzar la migración de la tabla contact_messages
// Este script se ejecuta directamente en el servidor de producción

const { Pool } = require('pg');

const forceMigration = async () => {
  console.log('🚀 Forzando migración de tabla contact_messages...');
  
  // Usar la URL de la base de datos de producción
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Crear tabla contact_messages
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

    // Crear índices
    console.log('📊 Creando índices...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at)`);

    // Verificar creación
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contact_messages'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Tabla contact_messages creada exitosamente');
      
      const countResult = await pool.query('SELECT COUNT(*) FROM contact_messages');
      console.log(`📊 Mensajes de contacto: ${countResult.rows[0].count}`);
      
      return true;
    } else {
      throw new Error('❌ Error: La tabla no se creó');
    }

  } catch (error) {
    console.error('❌ Error en migración forzada:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  forceMigration()
    .then(() => {
      console.log('🎉 Migración forzada completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = forceMigration;
