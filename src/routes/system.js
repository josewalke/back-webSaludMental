const express = require('express');
const Joi = require('joi');
const database = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, auditMiddleware } = require('../middleware/auth');

const router = express.Router();

// ========================================
// ESQUEMAS DE VALIDACIÓN
// ========================================

const configUpdateSchema = Joi.object({
  value: Joi.string().required().messages({
    'any.required': 'El valor es requerido'
  }),
  description: Joi.string().optional()
});

const systemStatsUpdateSchema = Joi.object({
  value: Joi.number().required().messages({
    'any.required': 'El valor es requerido'
  }),
  metadata: Joi.object().optional()
});

// ========================================
// RUTAS DEL SISTEMA
// ========================================

/**
 * GET /api/system/config
 * Obtener configuración del sistema
 */
router.get('/config', 
  requireRole(['admin', 'professional']),
  auditMiddleware('READ', 'SYSTEM_CONFIG'),
  asyncHandler(async (req, res) => {
    try {
      const configs = await database.all(
        'SELECT key, value, description, updated_at FROM system_config ORDER BY key'
      );

      const config = {};
      configs.forEach(item => {
        config[item.key] = {
          value: item.value,
          description: item.description,
          updatedAt: item.updated_at
        };
      });

      res.json({
        message: 'Configuración del sistema obtenida exitosamente',
        data: config
      });

    } catch (error) {
      console.error('Error al obtener configuración del sistema:', error);
      throw error;
    }
  })
);

/**
 * PUT /api/system/config/:key
 * Actualizar configuración del sistema
 */
router.put('/config/:key', 
  requireRole('admin'),
  auditMiddleware('UPDATE', 'SYSTEM_CONFIG'),
  asyncHandler(async (req, res) => {
    const configKey = req.params.key;
    const userId = req.user.id;

    // Validar datos de entrada
    const { error, value } = configUpdateSchema.validate(req.body);
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

    try {
      // Verificar que la configuración existe
      const existingConfig = await database.get(
        'SELECT key FROM system_config WHERE key = ?',
        [configKey]
      );

      if (!existingConfig) {
        return res.status(404).json({
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'Configuración no encontrada'
          }
        });
      }

      // Actualizar configuración
      await database.run(
        'UPDATE system_config SET value = ?, description = ?, updated_at = datetime("now"), updated_by = ? WHERE key = ?',
        [value.value, value.description || null, userId, configKey]
      );

      // Obtener configuración actualizada
      const updatedConfig = await database.get(
        'SELECT key, value, description, updated_at FROM system_config WHERE key = ?',
        [configKey]
      );

      res.json({
        message: 'Configuración actualizada exitosamente',
        data: {
          key: updatedConfig.key,
          value: updatedConfig.value,
          description: updatedConfig.description,
          updatedAt: updatedConfig.updated_at
        }
      });

    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/stats
 * Obtener estadísticas del sistema
 */
router.get('/stats', 
  requireRole(['admin', 'professional']),
  auditMiddleware('READ', 'SYSTEM_STATS'),
  asyncHandler(async (req, res) => {
    try {
      const stats = await database.all(
        'SELECT metric, value, metadata, updated_at FROM system_stats ORDER BY metric'
      );

      const systemStats = {};
      stats.forEach(item => {
        let metadata = {};
        try {
          metadata = JSON.parse(item.metadata || '{}');
        } catch (e) {
          metadata = { description: 'Error parsing metadata' };
        }

        systemStats[item.metric] = {
          value: item.value,
          metadata,
          updatedAt: item.updated_at
        };
      });

      res.json({
        message: 'Estadísticas del sistema obtenidas exitosamente',
        data: systemStats
      });

    } catch (error) {
      console.error('Error al obtener estadísticas del sistema:', error);
      throw error;
    }
  })
);

/**
 * PUT /api/system/stats/:metric
 * Actualizar estadísticas del sistema
 */
router.put('/stats/:metric', 
  requireRole('admin'),
  auditMiddleware('UPDATE', 'SYSTEM_STATS'),
  asyncHandler(async (req, res) => {
    const metric = req.params.metric;

    // Validar datos de entrada
    const { error, value } = systemStatsUpdateSchema.validate(req.body);
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

    try {
      // Verificar que la métrica existe
      const existingMetric = await database.get(
        'SELECT metric FROM system_stats WHERE metric = ?',
        [metric]
      );

      if (!existingMetric) {
        return res.status(404).json({
          error: {
            code: 'METRIC_NOT_FOUND',
            message: 'Métrica no encontrada'
          }
        });
      }

      // Actualizar estadística
      const metadata = value.metadata ? JSON.stringify(value.metadata) : null;
      await database.run(
        'UPDATE system_stats SET value = ?, metadata = ?, updated_at = datetime("now") WHERE metric = ?',
        [value.value, metadata, metric]
      );

      // Obtener estadística actualizada
      const updatedStat = await database.get(
        'SELECT metric, value, metadata, updated_at FROM system_stats WHERE metric = ?',
        [metric]
      );

      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(updatedStat.metadata || '{}');
      } catch (e) {
        parsedMetadata = {};
      }

      res.json({
        message: 'Estadística actualizada exitosamente',
        data: {
          metric: updatedStat.metric,
          value: updatedStat.value,
          metadata: parsedMetadata,
          updatedAt: updatedStat.updated_at
        }
      });

    } catch (error) {
      console.error('Error al actualizar estadística:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/audit-logs
 * Obtener logs de auditoría
 */
router.get('/audit-logs', 
  requireRole('admin'),
  auditMiddleware('READ', 'AUDIT_LOGS'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, action, resource, userId, startDate, endDate } = req.query;

    try {
      // Construir consulta base
      let whereClause = 'WHERE 1=1';
      let params = [];
      
      if (action) {
        whereClause += ' AND action = ?';
        params.push(action);
      }
      
      if (resource) {
        whereClause += ' AND resource = ?';
        params.push(resource);
      }
      
      if (userId) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Contar total de resultados
      const countResult = await database.get(
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        params
      );

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener logs paginados
      const logs = await database.all(
        `SELECT 
           al.*,
           u.name as user_name,
           u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      // Procesar logs
      const processedLogs = logs.map(log => {
        let details = {};
        try {
          details = JSON.parse(log.details || '{}');
        } catch (e) {
          details = { error: 'Error parsing details' };
        }

        return {
          id: log.id,
          action: log.action,
          resource: log.resource,
          resourceId: log.resource_id,
          details,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          createdAt: log.created_at,
          user: log.user_id ? {
            id: log.user_id,
            name: log.user_name,
            email: log.user_email
          } : null
        };
      });

      res.json({
        message: 'Logs de auditoría obtenidos exitosamente',
        data: {
          logs: processedLogs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener logs de auditoría:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/health
 * Obtener estado de salud del sistema
 */
router.get('/health', 
  auditMiddleware('READ', 'SYSTEM_HEALTH'),
  asyncHandler(async (req, res) => {
    try {
      // Verificar conexión a base de datos
      const dbStatus = database.isReady();
      
      // Obtener estadísticas de la base de datos
      const dbStats = await database.getStats();
      
      // Verificar tablas principales
      const tableChecks = await Promise.all([
        database.get('SELECT COUNT(*) as count FROM users'),
        database.get('SELECT COUNT(*) as count FROM questionnaires'),
        database.get('SELECT COUNT(*) as count FROM audit_logs')
      ]);

      // Verificar espacio en disco (simulado)
      const diskUsage = {
        total: '1GB',
        used: '256MB',
        free: '768MB',
        usagePercent: 25
      };

      // Verificar memoria del proceso
      const memoryUsage = process.memoryUsage();
      const memoryInfo = {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      };

      // Verificar uptime
      const uptime = {
        process: `${Math.round(process.uptime())}s`,
        system: `${Math.round(require('os').uptime())}s`
      };

      const health = {
        status: dbStatus ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus ? 'connected' : 'disconnected',
          stats: dbStats
        },
        tables: {
          users: tableChecks[0]?.count || 0,
          questionnaires: tableChecks[1]?.count || 0,
          auditLogs: tableChecks[2]?.count || 0
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          memory: memoryInfo,
          uptime,
          diskUsage
        }
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        message: `Sistema ${health.status}`,
        data: health
      });

    } catch (error) {
      console.error('Error al verificar salud del sistema:', error);
      
      res.status(503).json({
        message: 'Error verificando salud del sistema',
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error.message
        }
      });
    }
  })
);

/**
 * POST /api/system/maintenance
 * Activar/desactivar modo mantenimiento
 */
router.post('/maintenance', 
  requireRole('admin'),
  auditMiddleware('UPDATE', 'SYSTEM_MAINTENANCE'),
  asyncHandler(async (req, res) => {
    const { enabled, reason } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'El campo "enabled" debe ser un booleano'
        }
      });
    }

    try {
      // Actualizar configuración de mantenimiento
      await database.run(
        'UPDATE system_config SET value = ?, updated_at = datetime("now"), updated_by = ? WHERE key = "maintenance_mode"',
        [enabled.toString(), req.user.id]
      );

      // Registrar en logs de auditoría
      await database.run(
        'INSERT INTO audit_logs (user_id, action, resource, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          'MAINTENANCE_MODE',
          'SYSTEM',
          JSON.stringify({
            enabled,
            reason: reason || 'No especificado',
            timestamp: new Date().toISOString()
          }),
          req.ip,
          req.get('User-Agent')
        ]
      );

      res.json({
        message: `Modo mantenimiento ${enabled ? 'activado' : 'desactivado'} exitosamente`,
        data: {
          maintenanceMode: enabled,
          reason: reason || 'No especificado',
          updatedAt: new Date().toISOString(),
          updatedBy: req.user.id
        }
      });

    } catch (error) {
      console.error('Error al cambiar modo mantenimiento:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/backup
 * Crear backup del sistema
 */
router.get('/backup', 
  requireRole('admin'),
  auditMiddleware('CREATE', 'SYSTEM_BACKUP'),
  asyncHandler(async (req, res) => {
    try {
      // En una implementación real, aquí se haría el backup
      // Por ahora, simulamos la creación del backup
      
      const backupInfo = {
        id: `backup_${Date.now()}`,
        timestamp: new Date().toISOString(),
        size: '2.5MB',
        tables: ['users', 'questionnaires', 'audit_logs', 'system_config', 'system_stats'],
        status: 'completed',
        downloadUrl: `/api/system/backup/download/backup_${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
      };

      // Registrar backup en auditoría
      await database.run(
        'INSERT INTO audit_logs (user_id, action, resource, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          'BACKUP_CREATED',
          'SYSTEM',
          JSON.stringify(backupInfo),
          req.ip,
          req.get('User-Agent')
        ]
      );

      res.json({
        message: 'Backup del sistema creado exitosamente',
        data: backupInfo
      });

    } catch (error) {
      console.error('Error al crear backup:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/backup/download/:backupId
 * Descargar backup del sistema
 */
router.get('/backup/download/:backupId', 
  requireRole('admin'),
  auditMiddleware('DOWNLOAD', 'SYSTEM_BACKUP'),
  asyncHandler(async (req, res) => {
    const backupId = req.params.backupId;

    try {
      // En una implementación real, aquí se verificaría que el backup existe
      // y se enviaría el archivo real
      
      // Simular contenido del backup
      const backupContent = `-- Backup del sistema Nueva Web Salud Mental
-- Generado: ${new Date().toISOString()}
-- Usuario: ${req.user.name}

-- Estructura de la base de datos
-- ... (contenido del backup)`;

      // Configurar headers de descarga
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${backupId}.sql"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(backupContent);

    } catch (error) {
      console.error('Error al descargar backup:', error);
      throw error;
    }
  })
);

/**
 * GET /api/system/cleanup
 * Limpiar datos antiguos del sistema
 */
router.get('/cleanup', 
  requireRole('admin'),
  auditMiddleware('DELETE', 'SYSTEM_CLEANUP'),
  asyncHandler(async (req, res) => {
    try {
      // Limpiar sesiones expiradas
      const expiredSessions = await database.run(
        'DELETE FROM sessions WHERE expires_at < datetime("now")'
      );

      // Limpiar logs de auditoría antiguos (más de 1 año)
      const oldAuditLogs = await database.run(
        'DELETE FROM audit_logs WHERE created_at < datetime("now", "-1 year")'
      );

      // Limpiar estadísticas del sistema (mantener solo las últimas 100 entradas)
      const systemStatsCount = await database.get(
        'SELECT COUNT(*) as count FROM system_stats'
      );

      let cleanedSystemStats = 0;
      if (systemStatsCount.count > 100) {
        const statsToDelete = await database.all(
          'SELECT id FROM system_stats ORDER BY updated_at ASC LIMIT ?',
          [systemStatsCount.count - 100]
        );
        
        if (statsToDelete.length > 0) {
          const idsToDelete = statsToDelete.map(s => s.id).join(',');
          await database.run(
            `DELETE FROM system_stats WHERE id IN (${idsToDelete})`
          );
          cleanedSystemStats = statsToDelete.length;
        }
      }

      const cleanupResults = {
        timestamp: new Date().toISOString(),
        sessions: {
          expired: expiredSessions.changes,
          message: 'Sesiones expiradas eliminadas'
        },
        auditLogs: {
          old: oldAuditLogs.changes,
          message: 'Logs de auditoría antiguos eliminados'
        },
        systemStats: {
          cleaned: cleanedSystemStats,
          message: 'Estadísticas del sistema limpiadas'
        }
      };

      // Registrar limpieza en auditoría
      await database.run(
        'INSERT INTO audit_logs (user_id, action, resource, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          'SYSTEM_CLEANUP',
          'SYSTEM',
          JSON.stringify(cleanupResults),
          req.ip,
          req.get('User-Agent')
        ]
      );

      res.json({
        message: 'Limpieza del sistema completada exitosamente',
        data: cleanupResults
      });

    } catch (error) {
      console.error('Error al limpiar sistema:', error);
      throw error;
    }
  })
);

module.exports = router;
