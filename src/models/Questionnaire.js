const database = require('../database/connection');

/**
 * Modelo de Cuestionario que se corresponde con el frontend
 */
class Questionnaire {
  /**
   * Crear un nuevo cuestionario
   */
  static async create(data) {
    const { userId, type, personalInfo, answers, completed = false } = data;
    
    try {
      // ✅ Si no hay userId, asignar al administrador para cuestionarios anónimos
      let finalUserId = userId;
      
      if (!finalUserId) {
        // Buscar el usuario administrador
        const adminUser = await database.get(
          'SELECT id FROM users WHERE role = ? LIMIT 1',
          ['admin']
        );
        
        if (adminUser) {
          finalUserId = adminUser.id;
          console.log(`👤 Cuestionario anónimo asignado al administrador con ID: ${finalUserId}`);
        } else {
          throw new Error('No se encontró un usuario administrador para asignar cuestionarios anónimos');
        }
      }
      
      const result = await database.run(
        'INSERT INTO questionnaires (user_id, type, personal_info, answers, completed) VALUES (?, ?, ?, ?, ?)',
        [finalUserId, type, JSON.stringify(personalInfo), JSON.stringify(answers), completed ? 1 : 0]
      );

      return result.id;
    } catch (error) {
      throw new Error(`Error creando cuestionario: ${error.message}`);
    }
  }

  /**
   * Obtener cuestionario por ID
   */
  static async findById(id, userId) {
    try {
      const questionnaire = await database.get(
        'SELECT * FROM questionnaires WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!questionnaire) return null;

      return {
        id: questionnaire.id,
        type: questionnaire.type,
        personalInfo: JSON.parse(questionnaire.personal_info),
        answers: JSON.parse(questionnaire.answers),
        completed: Boolean(questionnaire.completed),
        completedAt: questionnaire.completed_at,
        createdAt: questionnaire.created_at,
        updatedAt: questionnaire.updated_at
      };
    } catch (error) {
      throw new Error(`Error obteniendo cuestionario: ${error.message}`);
    }
  }

  /**
   * Obtener cuestionarios por usuario
   */
  static async findByUser(userId, options = {}) {
    const { type, completed, page = 1, limit = 10 } = options;
    
    try {
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];
      
      if (type) {
        whereClause += ' AND type = ?';
        params.push(type);
      }
      
      if (completed !== undefined) {
        whereClause += ' AND completed = ?';
        params.push(completed ? 1 : 0);
      }

      // Contar total
      const countResult = await database.get(
        `SELECT COUNT(*) as total FROM questionnaires ${whereClause}`,
        params
      );

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener cuestionarios paginados
      const questionnaires = await database.all(
        `SELECT * FROM questionnaires ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const processedQuestionnaires = questionnaires.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: Boolean(q.completed),
        completedAt: q.completed_at,
        createdAt: q.created_at,
        updatedAt: q.updated_at
      }));

      return {
        questionnaires: processedQuestionnaires,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      throw new Error(`Error obteniendo cuestionarios: ${error.message}`);
    }
  }

  /**
   * Actualizar cuestionario
   */
  static async update(id, userId, data) {
    try {
      const { personalInfo, answers, completed } = data;
      
      const updateFields = [];
      const updateValues = [];

      if (personalInfo) {
        updateFields.push('personal_info = ?');
        updateValues.push(JSON.stringify(personalInfo));
      }

      if (answers) {
        updateFields.push('answers = ?');
        updateValues.push(JSON.stringify(answers));
      }

      if (completed !== undefined) {
        updateFields.push('completed = ?');
        updateValues.push(completed ? 1 : 0);
        
        if (completed) {
          updateFields.push('completed_at = datetime("now")');
        } else {
          updateFields.push('completed_at = NULL');
        }
      }

      if (updateFields.length > 0) {
        updateValues.push(id, userId);
        await database.run(
          `UPDATE questionnaires SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
          updateValues
        );
      }

      return await this.findById(id, userId);
    } catch (error) {
      throw new Error(`Error actualizando cuestionario: ${error.message}`);
    }
  }

  /**
   * Eliminar cuestionario
   */
  static async delete(id, userId) {
    try {
      const result = await database.run(
        'DELETE FROM questionnaires WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Error eliminando cuestionario: ${error.message}`);
    }
  }

  /**
   * Marcar como completado
   */
  static async markAsCompleted(id, userId) {
    try {
      await database.run(
        'UPDATE questionnaires SET completed = 1, completed_at = datetime("now") WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      return await this.findById(id, userId);
    } catch (error) {
      throw new Error(`Error marcando como completado: ${error.message}`);
    }
  }

  /**
   * Buscar cuestionarios por texto
   */
  static async search(userId, query, options = {}) {
    const { page = 1, limit = 10 } = options;
    
    try {
      const searchTerm = `%${query.trim()}%`;
      
      // Contar resultados
      const countResult = await database.get(
        'SELECT COUNT(*) as total FROM questionnaires WHERE user_id = ? AND (personal_info LIKE ? OR answers LIKE ?)',
        [userId, searchTerm, searchTerm]
      );

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Buscar cuestionarios
      const questionnaires = await database.all(
        'SELECT * FROM questionnaires WHERE user_id = ? AND (personal_info LIKE ? OR answers LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, searchTerm, searchTerm, limit, offset]
      );

      const processedQuestionnaires = questionnaires.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: Boolean(q.completed),
        completedAt: q.completed_at,
        createdAt: q.created_at,
        updatedAt: q.updated_at
      }));

      return {
        questionnaires: processedQuestionnaires,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        search: {
          query,
          results: total
        }
      };
    } catch (error) {
      throw new Error(`Error en búsqueda: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas del usuario
   */
  static async getUserStats(userId) {
    try {
      const stats = await database.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = ?',
        [userId]
      );

      const typeStats = await database.all(
        'SELECT type, COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = ? GROUP BY type',
        [userId]
      );

      const byType = {};
      typeStats.forEach(stat => {
        byType[stat.type] = {
          total: stat.total,
          completed: stat.completed,
          pending: stat.total - stat.completed,
          completionRate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0
        };
      });

      return {
        total: stats.total,
        completed: stats.completed,
        pending: stats.total - stats.completed,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        byType
      };
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener cuestionarios por tipo
   */
  static async findByType(userId, type, options = {}) {
    const { page = 1, limit = 10 } = options;
    
    try {
      // Contar total
      const countResult = await database.get(
        'SELECT COUNT(*) as total FROM questionnaires WHERE user_id = ? AND type = ?',
        [userId, type]
      );

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener cuestionarios
      const questionnaires = await database.all(
        'SELECT * FROM questionnaires WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, type, limit, offset]
      );

      const processedQuestionnaires = questionnaires.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: Boolean(q.completed),
        completedAt: q.completed_at,
        createdAt: q.created_at,
        updatedAt: q.updated_at
      }));

      // Estadísticas del tipo
      const stats = await database.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = ? AND type = ?',
        [userId, type]
      );

      return {
        questionnaires: processedQuestionnaires,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        type,
        stats: {
          total: stats.total,
          completed: stats.completed,
          pending: stats.total - stats.completed,
          completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        }
      };
    } catch (error) {
      throw new Error(`Error obteniendo cuestionarios por tipo: ${error.message}`);
    }
  }
}

module.exports = Questionnaire;
