const database = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Modelo de Usuario que se corresponde con el frontend
 */
class User {
  /**
   * Crear un nuevo usuario
   */
  static async create(userData) {
    const { 
      nombre, 
      apellidos, 
      edad, 
      genero, 
      correo, 
      orientacionSexual, 
      password 
    } = userData;

    try {
      // Verificar si el email ya existe
      const existingUser = await this.findByEmail(correo);
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 12);

      // Crear usuario usando la estructura correcta de la base de datos
      const result = await database.query(
        `INSERT INTO users (
          email, password, name, role, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
        [correo, hashedPassword, `${nombre} ${apellidos}`, 'assistant']
      );

      // Retornar usuario creado (sin contraseña)
      return await this.findById(result.rows[0].id);
    } catch (error) {
      throw new Error(`Error creando usuario: ${error.message}`);
    }
  }

  /**
   * Buscar usuario por ID
   */
  static async findById(id) {
    try {
      const result = await database.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      const user = result.rows[0];

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      throw new Error(`Error obteniendo usuario: ${error.message}`);
    }
  }

  /**
   * Buscar usuario por email
   */
  static async findByEmail(email) {
    try {
      console.log('🔍 Buscando usuario por email:', email);
      
      const result = await database.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      console.log('📊 Resultado de consulta:', {
        rowCount: result.rowCount,
        rows: result.rows,
        firstRow: result.rows[0]
      });
      
      const user = result.rows[0];

      if (!user) {
        console.log('❌ Usuario no encontrado en BD');
        return null;
      }

      console.log('✅ Usuario encontrado en BD:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasPassword: !!user.password,
        passwordLength: user.password ? user.password.length : 0
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        password: user.password,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('💥 Error en findByEmail:', error);
      throw new Error(`Error obteniendo usuario por email: ${error.message}`);
    }
  }

  /**
   * Verificar credenciales de login
   */
  static async verifyCredentials(email, password) {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        return { success: false, message: 'Credenciales inválidas' };
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Credenciales inválidas' };
      }

      // Retornar usuario sin contraseña
      const { passwordHash, ...userWithoutPassword } = user;
      return { success: true, user: userWithoutPassword };
    } catch (error) {
      throw new Error(`Error verificando credenciales: ${error.message}`);
    }
  }

  /**
   * Actualizar usuario
   */
  static async update(id, updateData) {
    try {
      const { 
        nombre, 
        apellidos, 
        edad, 
        genero, 
        orientacionSexual, 
        password 
      } = updateData;

      const updateFields = [];
      const updateValues = [];

      if (nombre) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
      }

      if (apellidos) {
        updateFields.push('apellidos = ?');
        updateValues.push(apellidos);
      }

      if (edad) {
        updateFields.push('edad = ?');
        updateValues.push(edad);
      }

      if (genero) {
        updateFields.push('genero = ?');
        updateValues.push(genero);
      }

      if (orientacionSexual) {
        updateFields.push('orientacion_sexual = ?');
        updateValues.push(orientacionSexual);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 12);
        updateFields.push('password_hash = ?');
        updateValues.push(hashedPassword);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = datetime("now")');
        updateValues.push(id);

        await database.run(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      return await this.findById(id);
    } catch (error) {
      throw new Error(`Error actualizando usuario: ${error.message}`);
    }
  }

  /**
   * Cambiar contraseña
   */
  static async changePassword(id, currentPassword, newPassword) {
    try {
      const user = await database.get(
        'SELECT password_hash FROM users WHERE id = ?',
        [id]
      );

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        throw new Error('La contraseña actual es incorrecta');
      }

      // Encriptar nueva contraseña
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Actualizar contraseña
      await database.run(
        'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
        [hashedNewPassword, id]
      );

      return true;
    } catch (error) {
      throw new Error(`Error cambiando contraseña: ${error.message}`);
    }
  }

  /**
   * Eliminar usuario
   */
  static async delete(id) {
    try {
      const result = await database.run(
        'DELETE FROM users WHERE id = ?',
        [id]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Error eliminando usuario: ${error.message}`);
    }
  }

  /**
   * Obtener perfil público del usuario
   */
  static async getPublicProfile(id) {
    try {
      const user = await database.get(
        'SELECT id, nombre, apellidos, edad, genero, orientacion_sexual FROM users WHERE id = ?',
        [id]
      );

      if (!user) return null;

      return {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        edad: user.edad,
        genero: user.genero,
        orientacionSexual: user.orientacion_sexual
      };
    } catch (error) {
      throw new Error(`Error obteniendo perfil público: ${error.message}`);
    }
  }

  /**
   * Buscar usuarios por criterios
   */
  static async search(criteria, options = {}) {
    const { page = 1, limit = 10 } = options;
    const { genero, orientacionSexual, edadMin, edadMax } = criteria;
    
    try {
      let whereClause = 'WHERE 1=1';
      let params = [];
      
      if (genero) {
        whereClause += ' AND genero = ?';
        params.push(genero);
      }
      
      if (orientacionSexual) {
        whereClause += ' AND orientacion_sexual = ?';
        params.push(orientacionSexual);
      }
      
      if (edadMin) {
        whereClause += ' AND edad >= ?';
        params.push(edadMin);
      }
      
      if (edadMax) {
        whereClause += ' AND edad <= ?';
        params.push(edadMax);
      }

      // Contar total
      const countResult = await database.get(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
      );

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Obtener usuarios paginados
      const users = await database.all(
        `SELECT id, nombre, apellidos, edad, genero, orientacion_sexual FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const processedUsers = users.map(user => ({
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        edad: user.edad,
        genero: user.genero,
        orientacionSexual: user.orientacion_sexual
      }));

      return {
        users: processedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      throw new Error(`Error en búsqueda de usuarios: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas del usuario
   */
  static async getUserStats(id) {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Obtener estadísticas de cuestionarios
      const questionnaireStats = await database.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = ?',
        [id]
      );

      // Obtener estadísticas por tipo de cuestionario
      const typeStats = await database.all(
        'SELECT type, COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM questionnaires WHERE user_id = ? GROUP BY type',
        [id]
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
        user: {
          id: user.id,
          nombre: user.nombre,
          apellidos: user.apellidos,
          edad: user.edad,
          genero: user.genero,
          orientacionSexual: user.orientacionSexual,
          createdAt: user.createdAt
        },
        questionnaires: {
          total: questionnaireStats.total,
          completed: questionnaireStats.completed,
          pending: questionnaireStats.total - questionnaireStats.completed,
          completionRate: questionnaireStats.total > 0 ? Math.round((questionnaireStats.completed / questionnaireStats.total) * 100) : 0,
          byType
        }
      };
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas del usuario: ${error.message}`);
    }
  }
}

module.exports = User;
