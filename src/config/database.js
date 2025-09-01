const { Pool } = require('pg');
const path = require('path');

let pool;

// Configuración para PostgreSQL (producción) vs SQLite (desarrollo)
// Usar SQLite si:
// 1. NODE_ENV es explícitamente 'development', O
// 2. No hay DATABASE_URL configurado, O  
// 3. DATABASE_URL contiene 'localhost' o '127.0.0.1' (desarrollo local)
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     !process.env.DATABASE_URL || 
                     (process.env.DATABASE_URL && (
                       process.env.DATABASE_URL.includes('localhost') || 
                       process.env.DATABASE_URL.includes('127.0.0.1') ||
                       process.env.DATABASE_URL.includes('sqlite')
                     ));

console.log('🔍 Detección de entorno:', {
  NODE_ENV: process.env.NODE_ENV,
  hasDATABASE_URL: !!process.env.DATABASE_URL,
  DATABASE_URL_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'No configurado',
  isDevelopment: isDevelopment
});

if (!isDevelopment) {
  // PostgreSQL en producción (Render)
  console.log('🐘 Conectando a PostgreSQL...');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test de conexión
  pool.on('connect', () => {
    console.log('✅ Conectado a PostgreSQL');
  });

  pool.on('error', (err) => {
    console.error('❌ Error en PostgreSQL:', err);
  });

} else {
  // SQLite para desarrollo local
  console.log('🗃️ Usando SQLite para desarrollo...');
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '../database/questionnaires.db');
  
  // Crear directorio si no existe
  const fs = require('fs');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(dbPath);
  
  // Adapter para que SQLite use la misma interfaz que PostgreSQL
  pool = {
    query: (text, params) => {
      return new Promise((resolve, reject) => {
        if (text.includes('RETURNING')) {
          // PostgreSQL RETURNING -> SQLite con lastID
          const insertText = text.replace(/RETURNING.*/, '');
          db.run(insertText, params, function(err) {
            if (err) reject(err);
            else resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
          });
        } else if (text.toUpperCase().startsWith('SELECT')) {
          db.all(text, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows, rowCount: rows.length });
          });
        } else {
          db.run(text, params, function(err) {
            if (err) reject(err);
            else resolve({ rowCount: this.changes });
          });
        }
      });
    },
    connect: () => Promise.resolve({ 
      query: pool.query,
      release: () => {}
    }),
    end: () => {
      return new Promise((resolve) => {
        db.close(resolve);
      });
    }
  };
}

module.exports = pool;
