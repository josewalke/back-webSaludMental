const database = require('../config/database');

class ContactMessage {
  /**
   * Crear un nuevo mensaje de contacto
   */
  static async create({ nombre, email, asunto, mensaje }) {
    try {
      console.log('📝 Creando mensaje de contacto:', { nombre, email, asunto });
      
      const result = await database.query(
        'INSERT INTO contact_messages (nombre, email, asunto, mensaje) VALUES ($1, $2, $3, $4) RETURNING id',
        [nombre, email, asunto, mensaje]
      );

      console.log('✅ Mensaje de contacto creado con ID:', result.rows[0].id);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error creando mensaje de contacto:', error);
      throw new Error(`Error creando mensaje de contacto: ${error.message}`);
    }
  }

  /**
   * Obtener todos los mensajes de contacto (para admin)
   */
  static async findAll() {
    try {
      const result = await database.query(
        'SELECT * FROM contact_messages ORDER BY created_at DESC'
      );

      return result.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        email: row.email,
        asunto: row.asunto,
        mensaje: row.mensaje,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error obteniendo mensajes de contacto:', error);
      throw new Error(`Error obteniendo mensajes de contacto: ${error.message}`);
    }
  }

  /**
   * Obtener mensaje por ID
   */
  static async findById(id) {
    try {
      const result = await database.query(
        'SELECT * FROM contact_messages WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        nombre: row.nombre,
        email: row.email,
        asunto: row.asunto,
        mensaje: row.mensaje,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('❌ Error obteniendo mensaje de contacto:', error);
      throw new Error(`Error obteniendo mensaje de contacto: ${error.message}`);
    }
  }

  /**
   * Actualizar status de un mensaje
   */
  static async updateStatus(id, status) {
    try {
      const result = await database.query(
        'UPDATE contact_messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
        [status, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Mensaje no encontrado');
      }

      console.log('✅ Status del mensaje actualizado:', { id, status });
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error actualizando status del mensaje:', error);
      throw new Error(`Error actualizando status del mensaje: ${error.message}`);
    }
  }

  /**
   * Eliminar mensaje por ID
   */
  static async delete(id) {
    try {
      const result = await database.query(
        'DELETE FROM contact_messages WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Mensaje no encontrado');
      }

      console.log('✅ Mensaje de contacto eliminado:', id);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error eliminando mensaje de contacto:', error);
      throw new Error(`Error eliminando mensaje de contacto: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats() {
    try {
      const totalResult = await database.query('SELECT COUNT(*) FROM contact_messages');
      const unreadResult = await database.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'");
      const readResult = await database.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'read'");
      const repliedResult = await database.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'replied'");

      return {
        total: parseInt(totalResult.rows[0].count),
        unread: parseInt(unreadResult.rows[0].count),
        read: parseInt(readResult.rows[0].count),
        replied: parseInt(repliedResult.rows[0].count)
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de mensajes:', error);
      throw new Error(`Error obteniendo estadísticas de mensajes: ${error.message}`);
    }
  }
}

module.exports = ContactMessage;

