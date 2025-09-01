const database = require('../config/database');

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
        const adminResult = await database.query(
          'SELECT id FROM users WHERE role = $1 LIMIT 1',
          ['admin']
        );
        
        if (adminResult.rows.length > 0) {
          finalUserId = adminResult.rows[0].id;
          console.log(`👤 Cuestionario anónimo asignado al administrador con ID: ${finalUserId}`);
        } else {
          throw new Error('No se encontró un usuario administrador para asignar cuestionarios anónimos');
        }
      }
      
      // ✅ LIMPIEZA AGRESIVA: Asegurar que las respuestas sean strings válidos
      const cleanAnswers = {};
      if (answers && typeof answers === 'object') {
        Object.entries(answers).forEach(([questionId, answer]) => {
          let answerText = '';
          
          // Log para debug
          console.log(`🔍 Procesando respuesta para pregunta ${questionId}:`, {
            originalAnswer: answer,
            type: typeof answer,
            isObject: answer && typeof answer === 'object'
          });
          
          if (typeof answer === 'string') {
            answerText = answer;
          } else if (answer && typeof answer === 'object') {
            // Si es un objeto, extraer el texto de la respuesta
            if (answer.text && typeof answer.text === 'string') {
              answerText = answer.text;
            } else if (answer.answer && typeof answer.answer === 'string') {
              answerText = answer.answer;
            } else if (answer.value && typeof answer.value === 'string') {
              answerText = answer.value;
            } else if (answer.label && typeof answer.label === 'string') {
              answerText = answer.label;
            } else if (answer.name && typeof answer.name === 'string') {
              answerText = answer.name;
            } else {
              // Último recurso: convertir a string
              answerText = String(answer);
              console.warn(`⚠️ Respuesta convertida a string para pregunta ${questionId}:`, answerText);
            }
          } else {
            // Convertir cualquier otro tipo a string
            answerText = String(answer);
            console.warn(`⚠️ Respuesta convertida a string para pregunta ${questionId}:`, answerText);
          }
          
          // ✅ VALIDACIÓN FINAL: Asegurar que sea string válido
          if (typeof answerText !== 'string') {
            answerText = String(answerText);
          }
          
          // ✅ VERIFICAR QUE NO CONTENGA [object Object]
          if (answerText.includes('[object Object]')) {
            console.error(`❌ ERROR: Respuesta contiene [object Object] para pregunta ${questionId}:`, answerText);
            answerText = 'Respuesta no válida';
          }
          
          cleanAnswers[questionId] = answerText;
          
          console.log(`✅ Respuesta procesada para pregunta ${questionId}:`, {
            original: answer,
            processed: answerText,
            finalType: typeof answerText
          });
        });
      }
      
      console.log('🧹 RESPUESTAS FINALES LIMPIAS:', cleanAnswers);
      
      const result = await database.query(
        'INSERT INTO questionnaires (user_id, type, personal_info, answers, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
        [finalUserId, type, JSON.stringify(personalInfo), JSON.stringify(cleanAnswers), completed ? 'completed' : 'pending']
      );

      return result.rows[0].id;
    } catch (error) {
      throw new Error(`Error creando cuestionario: ${error.message}`);
    }
  }

  /**
   * Obtener cuestionario por ID
   */
  static async findById(id, userId = null) {
    try {
      let query = 'SELECT * FROM questionnaires WHERE id = $1';
      let params = [id];
      if (userId !== null && userId !== undefined) {
        query += ' AND user_id = $2';
        params.push(userId);
      }

      const result = await database.query(
        query,
        params
      );

      if (result.rows.length === 0) return null;
      
      const questionnaire = result.rows[0];

      return {
        id: questionnaire.id,
        type: questionnaire.type,
        personalInfo: JSON.parse(questionnaire.personal_info),
        answers: JSON.parse(questionnaire.answers),
        completed: questionnaire.status === 'completed',
        completedAt: questionnaire.updated_at,
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
      let whereClause = 'WHERE user_id = $1';
      let params = [userId];
      
      if (type) {
        whereClause += ' AND type = $' + (params.length + 1);
        params.push(type);
      }
      
      if (completed !== undefined) {
        whereClause += ' AND status = $' + (params.length + 1);
        params.push(completed ? 'completed' : 'pending');
      }

      // Contar total
      const countResult = await database.query(
        `SELECT COUNT(*) as total FROM questionnaires ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener cuestionarios paginados
      const questionnaires = await database.query(
        `SELECT * FROM questionnaires ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const processedQuestionnaires = questionnaires.rows.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: q.status === 'completed',
        completedAt: q.updated_at,
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
        updateFields.push('personal_info = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(personalInfo));
      }

      if (answers) {
        updateFields.push('answers = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(answers));
      }

      if (completed !== undefined) {
        updateFields.push('status = $' + (updateValues.length + 1));
        updateValues.push(completed ? 'completed' : 'pending');
        
        if (completed) {
          updateFields.push('updated_at = CURRENT_TIMESTAMP');
        } else {
          updateFields.push('updated_at = CURRENT_TIMESTAMP');
        }
      }

      if (updateFields.length > 0) {
        updateValues.push(id, userId);
        await database.query(
          `UPDATE questionnaires SET ${updateFields.join(', ')} WHERE id = $${updateValues.length - 1} AND user_id = $${updateValues.length}`,
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
      const result = await database.query(
        'DELETE FROM questionnaires WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Error eliminando cuestionario: ${error.message}`);
    }
  }

  /**
   * Marcar como completado
   */
  static async markAsCompleted(id, userId) {
    try {
      await database.query(
        'UPDATE questionnaires SET status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
        [id, userId, 'completed']
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
      const countResult = await database.query(
        'SELECT COUNT(*) as total FROM questionnaires WHERE user_id = $1 AND (personal_info LIKE $2 OR answers LIKE $3)',
        [userId, searchTerm, searchTerm]
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Buscar cuestionarios
      const questionnaires = await database.query(
        'SELECT * FROM questionnaires WHERE user_id = $1 AND (personal_info LIKE $2 OR answers LIKE $3) ORDER BY created_at DESC LIMIT $4 OFFSET $5',
        [userId, searchTerm, searchTerm, limit, offset]
      );

      const processedQuestionnaires = questionnaires.rows.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: q.status === 'completed',
        completedAt: q.updated_at,
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
      const stats = await database.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = $1',
        [userId, 'completed']
      );

      const typeStats = await database.query(
        'SELECT type, COUNT(*) as total, SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = $1 GROUP BY type',
        [userId, 'completed']
      );

      const byType = {};
      typeStats.rows.forEach(stat => {
        byType[stat.type] = {
          total: stat.total,
          completed: stat.completed,
          pending: stat.total - stat.completed,
          completionRate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0
        };
      });

      return {
        total: parseInt(stats.rows[0].total),
        completed: parseInt(stats.rows[0].completed || 0),
        pending: parseInt(stats.rows[0].total) - parseInt(stats.rows[0].completed || 0),
        completionRate: parseInt(stats.rows[0].total) > 0 ? Math.round((parseInt(stats.rows[0].completed || 0) / parseInt(stats.rows[0].total)) * 100) : 0,
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
      const countResult = await database.query(
        'SELECT COUNT(*) as total FROM questionnaires WHERE user_id = $1 AND type = $2',
        [userId, type]
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener cuestionarios
      const questionnaires = await database.query(
        'SELECT * FROM questionnaires WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
        [userId, type, limit, offset]
      );

      const processedQuestionnaires = questionnaires.rows.map(q => ({
        id: q.id,
        type: q.type,
        personalInfo: JSON.parse(q.personal_info),
        answers: JSON.parse(q.answers),
        completed: q.status === 'completed',
        completedAt: q.updated_at,
        createdAt: q.created_at,
        updatedAt: q.updated_at
      }));

      // Estadísticas del tipo
      const stats = await database.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = $3 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = $1 AND type = $2',
        [userId, type, 'completed']
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
          total: parseInt(stats.rows[0].total),
          completed: parseInt(stats.rows[0].completed || 0),
          pending: parseInt(stats.rows[0].total) - parseInt(stats.rows[0].completed || 0),
          completionRate: parseInt(stats.rows[0].total) > 0 ? Math.round((parseInt(stats.rows[0].completed || 0) / parseInt(stats.rows[0].total)) * 100) : 0
        }
      };
    } catch (error) {
      throw new Error(`Error obteniendo cuestionarios por tipo: ${error.message}`);
    }
  }
}

module.exports = Questionnaire;
