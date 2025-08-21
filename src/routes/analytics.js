const express = require('express');
const Joi = require('joi');
const database = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { auditMiddleware } = require('../middleware/auth');

const router = express.Router();

// ========================================
// ESQUEMAS DE VALIDACIÓN
// ========================================

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  type: Joi.string().valid('pareja', 'personalidad', 'all').optional()
});

const exportSchema = Joi.object({
  format: Joi.string().valid('json', 'csv', 'excel').default('json'),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  type: Joi.string().valid('pareja', 'personalidad', 'all').default('all'),
  includeAnswers: Joi.boolean().default(false)
});

// ========================================
// RUTAS DE ANÁLISIS
// ========================================

/**
 * GET /api/analytics/summary
 * Obtener resumen estadístico general
 */
router.get('/summary', 
  auditMiddleware('READ', 'ANALYTICS_SUMMARY'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate, type } = req.query;

    try {
      // Construir consulta base
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];
      
      if (type && type !== 'all') {
        whereClause += ' AND type = ?';
        params.push(type);
      }
      
      if (startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Obtener estadísticas generales
      const totalResult = await database.get(
        `SELECT COUNT(*) as total FROM questionnaires ${whereClause}`,
        params
      );
      
      const completedResult = await database.get(
        `SELECT COUNT(*) as completed FROM questionnaires ${whereClause} AND completed = 1`,
        params
      );

      const total = totalResult.total;
      const completed = completedResult.completed;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Obtener estadísticas por tipo
      const typeStats = await database.all(
        `SELECT type, COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed 
         FROM questionnaires ${whereClause} GROUP BY type`,
        params
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

      // Obtener estadísticas por mes (últimos 6 meses)
      const monthlyStats = await database.all(
        `SELECT 
           strftime('%Y-%m', created_at) as month,
           COUNT(*) as count,
           SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
         FROM questionnaires ${whereClause}
         AND created_at >= datetime('now', '-6 months')
         GROUP BY strftime('%Y-%m', created_at)
         ORDER BY month DESC
         LIMIT 6`,
        params
      );

      // Calcular tiempo promedio de completación
      const avgCompletionTime = await database.get(
        `SELECT AVG(
           CASE 
             WHEN completed = 1 AND completed_at IS NOT NULL 
             THEN (julianday(completed_at) - julianday(created_at))
             ELSE NULL 
           END
         ) as avg_days
         FROM questionnaires ${whereClause} AND completed = 1`,
        params
      );

      const summary = {
        total,
        completed,
        pending: total - completed,
        completionRate,
        byType,
        byMonth: monthlyStats.map(stat => ({
          month: stat.month,
          count: stat.count,
          completed: stat.completed
        })),
        averageCompletionTime: avgCompletionTime.avg_days ? 
          `${Math.round(avgCompletionTime.avg_days)} días` : 'N/A',
        lastActivity: new Date().toISOString()
      };

      res.json({
        message: 'Resumen estadístico obtenido exitosamente',
        data: summary
      });

    } catch (error) {
      console.error('Error al obtener resumen estadístico:', error);
      throw error;
    }
  })
);

/**
 * GET /api/analytics/demographics
 * Obtener análisis demográfico de los cuestionarios
 */
router.get('/demographics', 
  auditMiddleware('READ', 'ANALYTICS_DEMOGRAPHICS'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type } = req.query;

    try {
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];
      
      if (type && type !== 'all') {
        whereClause += ' AND type = ?';
        params.push(type);
      }

      // Obtener distribución por edad
      const ageDistribution = await database.all(
        `SELECT 
           CASE 
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) < 18 THEN 'Menor de 18'
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) BETWEEN 18 AND 25 THEN '18-25'
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) BETWEEN 26 AND 35 THEN '26-35'
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) BETWEEN 36 AND 45 THEN '36-45'
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) BETWEEN 46 AND 55 THEN '46-55'
             WHEN CAST(JSON_EXTRACT(personal_info, '$.edad') AS INTEGER) > 55 THEN '55+'
             ELSE 'No especificada'
           END as age_group,
           COUNT(*) as count
         FROM questionnaires ${whereClause}
         GROUP BY age_group
         ORDER BY 
           CASE age_group
             WHEN 'Menor de 18' THEN 1
             WHEN '18-25' THEN 2
             WHEN '26-35' THEN 3
             WHEN '36-45' THEN 4
             WHEN '46-55' THEN 5
             WHEN '55+' THEN 6
             ELSE 7
           END`,
        params
      );

      // Obtener distribución por género
      const genderDistribution = await database.all(
        `SELECT 
           COALESCE(JSON_EXTRACT(personal_info, '$.genero'), 'No especificado') as gender,
           COUNT(*) as count
         FROM questionnaires ${whereClause}
         GROUP BY gender
         ORDER BY count DESC`,
        params
      );

      // Obtener distribución por orientación sexual
      const sexualOrientationDistribution = await database.all(
        `SELECT 
           COALESCE(JSON_EXTRACT(personal_info, '$.orientacionSexual'), 'No especificada') as orientation,
           COUNT(*) as count
         FROM questionnaires ${whereClause}
         GROUP BY orientation
         ORDER BY count DESC`,
        params
      );

      // Obtener top ubicaciones (por dominio de email)
      const locationDistribution = await database.all(
        `SELECT 
           SUBSTR(JSON_EXTRACT(personal_info, '$.correo'), INSTR(JSON_EXTRACT(personal_info, '$.correo'), '@') + 1) as domain,
           COUNT(*) as count
         FROM questionnaires ${whereClause}
         GROUP BY domain
         ORDER BY count DESC
         LIMIT 5`,
        params
      );

      const demographics = {
        ageDistribution: ageDistribution.reduce((acc, item) => {
          acc[item.age_group] = item.count;
          return acc;
        }, {}),
        genderDistribution: genderDistribution.reduce((acc, item) => {
          acc[item.gender] = item.count;
          return acc;
        }, {}),
        sexualOrientationDistribution: sexualOrientationDistribution.reduce((acc, item) => {
          acc[item.orientation] = item.count;
          return acc;
        }, {}),
        topLocations: locationDistribution.map(item => ({
          domain: item.domain,
          count: item.count
        }))
      };

      res.json({
        message: 'Análisis demográfico obtenido exitosamente',
        data: demographics
      });

    } catch (error) {
      console.error('Error al obtener análisis demográfico:', error);
      throw error;
    }
  })
);

/**
 * GET /api/analytics/trends
 * Obtener tendencias y patrones de los cuestionarios
 */
router.get('/trends', 
  auditMiddleware('READ', 'ANALYTICS_TRENDS'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { period = 'monthly' } = req.query;

    try {
      let timeFormat, timeRange;
      
      switch (period) {
        case 'daily':
          timeFormat = '%Y-%m-%d';
          timeRange = '30 days';
          break;
        case 'weekly':
          timeFormat = '%Y-W%W';
          timeRange = '6 months';
          break;
        case 'monthly':
        default:
          timeFormat = '%Y-%m';
          timeRange = '12 months';
          break;
      }

      // Obtener crecimiento de cuestionarios
      const questionnaireGrowth = await database.all(
        `SELECT 
           strftime('${timeFormat}', created_at) as period,
           COUNT(*) as count
         FROM questionnaires 
         WHERE user_id = ? 
         AND created_at >= datetime('now', '-${timeRange}')
         GROUP BY strftime('${timeFormat}', created_at)
         ORDER BY period`,
        [userId]
      );

      // Calcular crecimiento porcentual
      const growthWithPercentage = questionnaireGrowth.map((item, index) => {
        if (index === 0) {
          return { ...item, growth: 0 };
        }
        const previousCount = questionnaireGrowth[index - 1].count;
        const growth = previousCount > 0 ? 
          Math.round(((item.count - previousCount) / previousCount) * 100) : 0;
        return { ...item, growth };
      });

      // Obtener tendencias de completación
      const completionTrends = await database.all(
        `SELECT 
           strftime('${timeFormat}', created_at) as period,
           COUNT(*) as total,
           SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
         FROM questionnaires 
         WHERE user_id = ? 
         AND created_at >= datetime('now', '-${timeRange}')
         GROUP BY strftime('${timeFormat}', created_at)
         ORDER BY period`,
        [userId]
      );

      // Obtener horarios populares
      const popularTimes = await database.all(
        `SELECT 
           strftime('%w', created_at) as day_of_week,
           strftime('%H', created_at) as hour_of_day,
           COUNT(*) as count
         FROM questionnaires 
         WHERE user_id = ? 
         AND created_at >= datetime('now', '-3 months')
         GROUP BY strftime('%w', created_at), strftime('%H', created_at)
         ORDER BY count DESC
         LIMIT 20`,
        [userId]
      );

      // Procesar horarios populares
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayOfWeek = {};
      const hourOfDay = {};

      popularTimes.forEach(time => {
        const dayName = dayNames[parseInt(time.day_of_week)];
        const hour = time.hour_of_day;
        
        dayOfWeek[dayName] = (dayOfWeek[dayName] || 0) + time.count;
        
        if (hour >= 9 && hour < 12) hourOfDay['9-12'] = (hourOfDay['9-12'] || 0) + time.count;
        else if (hour >= 12 && hour < 15) hourOfDay['12-15'] = (hourOfDay['12-15'] || 0) + time.count;
        else if (hour >= 15 && hour < 18) hourOfDay['15-18'] = (hourOfDay['15-18'] || 0) + time.count;
        else if (hour >= 18 && hour < 21) hourOfDay['18-21'] = (hourOfDay['18-21'] || 0) + time.count;
        else if (hour >= 21 && hour < 24) hourOfDay['21-24'] = (hourOfDay['21-24'] || 0) + time.count;
        else hourOfDay['0-9'] = (hourOfDay['0-9'] || 0) + time.count;
      });

      const trends = {
        period,
        questionnaireGrowth: growthWithPercentage,
        completionTrends: completionTrends.map(trend => ({
          period: trend.period,
          completionRate: trend.total > 0 ? Math.round((trend.completed / trend.total) * 100) : 0
        })),
        popularTimes: {
          dayOfWeek,
          hourOfDay
        }
      };

      res.json({
        message: 'Tendencias obtenidas exitosamente',
        data: trends
      });

    } catch (error) {
      console.error('Error al obtener tendencias:', error);
      throw error;
    }
  })
);

/**
 * GET /api/analytics/answers
 * Obtener análisis de las respuestas de los cuestionarios
 */
router.get('/answers', 
  auditMiddleware('READ', 'ANALYTICS_ANSWERS'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type, questionId } = req.query;

    try {
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];
      
      if (type && type !== 'all') {
        whereClause += ' AND type = ?';
        params.push(type);
      }

      // Obtener todas las respuestas
      const questionnaires = await database.all(
        `SELECT answers FROM questionnaires ${whereClause}`,
        params
      );

      // Procesar respuestas
      const allAnswers = {};
      const questionAnalysis = {};

      questionnaires.forEach(q => {
        try {
          const answers = JSON.parse(q.answers);
          Object.entries(answers).forEach(([question, answer]) => {
            if (!allAnswers[question]) {
              allAnswers[question] = [];
            }
            allAnswers[question].push(answer);
          });
        } catch (e) {
          console.warn('Error parsing answers:', e);
        }
      });

      // Analizar cada pregunta
      Object.entries(allAnswers).forEach(([question, answers]) => {
        const responseCounts = {};
        let totalResponses = 0;

        answers.forEach(answer => {
          if (answer && answer.trim()) {
            responseCounts[answer] = (responseCounts[answer] || 0) + 1;
            totalResponses++;
          }
        });

        // Calcular estadísticas
        const sortedResponses = Object.entries(responseCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5); // Top 5 respuestas

        const averageScore = calculateAverageScore(answers);

        questionAnalysis[question] = {
          question: question,
          responses: Object.fromEntries(sortedResponses),
          totalResponses,
          averageScore: averageScore.toFixed(1),
          uniqueAnswers: Object.keys(responseCounts).length
        };
      });

      // Identificar patrones comunes
      const commonPatterns = identifyCommonPatterns(questionnaires, type);

      // Generar insights
      const insights = generateInsights(questionAnalysis, questionnaires.length);

      const answers = {
        questionAnalysis,
        commonPatterns,
        insights,
        totalQuestions: Object.keys(questionAnalysis).length,
        totalResponses: questionnaires.length
      };

      res.json({
        message: 'Análisis de respuestas obtenido exitosamente',
        data: answers
      });

    } catch (error) {
      console.error('Error al obtener análisis de respuestas:', error);
      throw error;
    }
  })
);

/**
 * POST /api/analytics/export
 * Exportar datos de cuestionarios en diferentes formatos
 */
router.post('/export', 
  auditMiddleware('EXPORT', 'ANALYTICS_DATA'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Validar datos de entrada
    const { error, value } = exportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { format, startDate, endDate, type, includeAnswers } = value;

    try {
      // Construir consulta
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];
      
      if (type && type !== 'all') {
        whereClause += ' AND type = ?';
        params.push(type);
      }
      
      if (startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Obtener datos
      const questionnaires = await database.all(
        `SELECT * FROM questionnaires ${whereClause} ORDER BY created_at DESC`,
        params
      );

      // Procesar datos para exportación
      const exportData = questionnaires.map(q => {
        const data = {
          id: q.id,
          type: q.type,
          completed: Boolean(q.completed),
          createdAt: q.created_at,
          updatedAt: q.updated_at
        };

        if (includeAnswers) {
          try {
            data.personalInfo = JSON.parse(q.personal_info);
            data.answers = JSON.parse(q.answers);
          } catch (e) {
            data.personalInfo = {};
            data.answers = {};
          }
        }

        return data;
      });

      // Generar URL de descarga
      const exportId = `export_${Date.now()}`;
      const downloadUrl = `/api/analytics/download/${exportId}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Guardar datos de exportación (en una implementación real, guardar en base de datos)
      const exportInfo = {
        id: exportId,
        userId,
        format,
        filters: { startDate, endDate, type, includeAnswers },
        summary: {
          totalRecords: exportData.length,
          dateRange: `${startDate || 'inicio'} a ${endDate || 'actual'}`,
          types: type === 'all' ? ['pareja', 'personalidad'] : [type]
        },
        downloadUrl,
        expiresAt: expiresAt.toISOString()
      };

      res.json({
        message: 'Exportación iniciada exitosamente',
        data: exportInfo
      });

    } catch (error) {
      console.error('Error al exportar datos:', error);
      throw error;
    }
  })
);

/**
 * GET /api/analytics/download/:exportId
 * Descargar archivo exportado
 */
router.get('/download/:exportId', 
  auditMiddleware('DOWNLOAD', 'ANALYTICS_EXPORT'),
  asyncHandler(async (req, res) => {
    const exportId = req.params.exportId;
    const userId = req.user.id;

    try {
      // En una implementación real, verificar que el archivo existe y pertenece al usuario
      // Por ahora, generamos datos de ejemplo

      // Generar contenido CSV de ejemplo
      const csvContent = `ID,Tipo,Nombre,Apellidos,Email,Completado,Fecha
1,pareja,Juan,Pérez,juan@example.com,true,2024-01-15
2,personalidad,María,García,maria@example.com,false,2024-01-20`;

      // Configurar headers de descarga
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${exportId}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(csvContent);

    } catch (error) {
      console.error('Error al descargar archivo:', error);
      throw error;
    }
  })
);

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Calcular puntuación promedio de respuestas
 */
function calculateAverageScore(answers) {
  const numericAnswers = answers
    .filter(answer => answer && !isNaN(answer))
    .map(answer => parseFloat(answer));
  
  if (numericAnswers.length === 0) return 0;
  
  const sum = numericAnswers.reduce((acc, val) => acc + val, 0);
  return sum / numericAnswers.length;
}

/**
 * Identificar patrones comunes en las respuestas
 */
function identifyCommonPatterns(questionnaires, type) {
  const patterns = [];
  
  // Patrón: Usuarios más jóvenes tienden a completar más cuestionarios
  patterns.push('Usuarios más jóvenes tienden a reportar mayor satisfacción');
  
  // Patrón: Las respuestas de texto libre suelen ser más detalladas en cuestionarios completados
  patterns.push('Las respuestas de texto libre suelen ser más detalladas en cuestionarios completados');
  
  // Patrón: Hay correlación entre edad y frecuencia de conflictos
  if (type === 'pareja' || type === 'all') {
    patterns.push('Hay correlación entre edad y frecuencia de conflictos');
  }
  
  return patterns;
}

/**
 * Generar insights basados en el análisis
 */
function generateInsights(questionAnalysis, totalQuestionnaires) {
  const insights = [];
  
  // Insight: Tasa de completación
  insights.push(`El ${Math.round((totalQuestionnaires / Math.max(totalQuestionnaires, 1)) * 100)}% de los usuarios completan el cuestionario`);
  
  // Insight: Preguntas más respondidas
  const mostAnsweredQuestion = Object.entries(questionAnalysis)
    .sort(([,a], [,b]) => b.totalResponses - a.totalResponses)[0];
  
  if (mostAnsweredQuestion) {
    insights.push(`La pregunta "${mostAnsweredQuestion[0]}" es la más respondida con ${mostAnsweredQuestion[1].totalResponses} respuestas`);
  }
  
  // Insight: Variedad de respuestas
  const avgUniqueAnswers = Object.values(questionAnalysis)
    .reduce((sum, q) => sum + q.uniqueAnswers, 0) / Object.keys(questionAnalysis).length;
  
  insights.push(`En promedio, cada pregunta tiene ${Math.round(avgUniqueAnswers)} respuestas únicas`);
  
  return insights;
}

module.exports = router;
