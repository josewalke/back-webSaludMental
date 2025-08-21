const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuración de la base de datos
const DB_PATH = path.join(__dirname, '../../database.sqlite');
const DB_MODE = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;

class Database {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Conectar a la base de datos SQLite
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Crear directorio de base de datos si no existe
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(DB_PATH, DB_MODE, (err) => {
          if (err) {
            console.error('❌ Error conectando a SQLite:', err.message);
            reject(err);
            return;
          }

          this.isConnected = true;
          console.log('✅ Conectado a SQLite en:', DB_PATH);
          
          // Habilitar foreign keys
          this.db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
              console.warn('⚠️ No se pudieron habilitar foreign keys:', err.message);
            }
          });

          // Configurar modo WAL para mejor performance
          this.db.run('PRAGMA journal_mode = WAL', (err) => {
            if (err) {
              console.warn('⚠️ No se pudo configurar modo WAL:', err.message);
            }
          });

          // Configurar cache size
          this.db.run('PRAGMA cache_size = 10000', (err) => {
            if (err) {
              console.warn('⚠️ No se pudo configurar cache size:', err.message);
            }
          });

          resolve();
        });

        // Manejar errores de la base de datos
        this.db.on('error', (err) => {
          console.error('💥 Error de base de datos:', err);
          this.isConnected = false;
        });

      } catch (error) {
        console.error('💥 Error creando conexión:', error);
        reject(error);
      }
    });
  }

  /**
   * Ejecutar una consulta SQL
   */
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Base de datos no conectada'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  /**
   * Obtener una fila
   */
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Base de datos no conectada'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Obtener múltiples filas
   */
  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Base de datos no conectada'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * Ejecutar múltiples consultas en una transacción
   */
  async transaction(queries) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Base de datos no conectada'));
        return;
      }

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const results = [];
        let hasError = false;

        queries.forEach((query, index) => {
          this.db.run(query.sql, query.params || [], function(err) {
            if (err && !hasError) {
              hasError = true;
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }

            results.push({
              id: this.lastID,
              changes: this.changes,
              index
            });

            // Si es la última consulta y no hay errores
            if (index === queries.length - 1 && !hasError) {
              this.db.run('COMMIT', (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(results);
              });
            }
          });
        });
      });
    });
  }

  /**
   * Verificar si la base de datos está conectada
   */
  isReady() {
    return this.isConnected && this.db !== null;
  }

  /**
   * Cerrar la conexión
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        this.isConnected = false;
        this.db = null;
        console.log('🔌 Conexión a SQLite cerrada');
        resolve();
      });
    });
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  async getStats() {
    try {
      const stats = await this.all(`
        SELECT 
          name,
          sql
        FROM sqlite_master 
        WHERE type='table'
        ORDER BY name
      `);

      const tableCounts = {};
      for (const table of stats) {
        if (table.name !== 'sqlite_sequence') {
          const count = await this.get(`SELECT COUNT(*) as count FROM ${table.name}`);
          tableCounts[table.name] = count.count;
        }
      }

      return {
        tables: stats.length,
        tableCounts,
        path: DB_PATH,
        size: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }
}

// Instancia singleton de la base de datos
const database = new Database();

module.exports = database;
