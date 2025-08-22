#!/usr/bin/env node

/**
 * Script para insertar datos de ejemplo en la base de datos
 * Crea cuestionarios de prueba para el dashboard admin
 */

require('dotenv').config();
const database = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function seedData() {
  try {
    console.log('🌱 Iniciando inserción de datos de ejemplo...');
    
    // Verificar conexión
    const testResult = await database.query('SELECT 1 as test');
    console.log('✅ Conexión a base de datos exitosa');
    
    // 1. Crear usuarios de ejemplo
    console.log('👥 Creando usuarios de ejemplo...');
    
    const users = [
      {
        email: 'maria@ejemplo.com',
        password: await bcrypt.hash('password123', 10),
        name: 'María García',
        role: 'user'
      },
      {
        email: 'juan@ejemplo.com',
        password: await bcrypt.hash('password123', 10),
        name: 'Juan López',
        role: 'user'
      },
      {
        email: 'ana@ejemplo.com',
        password: await bcrypt.hash('password123', 10),
        name: 'Ana Martínez',
        role: 'user'
      }
    ];
    
    for (const user of users) {
      const existingUser = await database.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );
      
      if (existingUser.rows.length === 0) {
        const result = await database.query(
          `INSERT INTO users (email, password, name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [user.email, user.password, user.name, user.role]
        );
        console.log(`✅ Usuario creado: ${user.name} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`⏭️ Usuario ya existe: ${user.name}`);
      }
    }
    
    // 2. Crear cuestionarios de ejemplo
    console.log('📝 Creando cuestionarios de ejemplo...');
    
    // Obtener IDs de usuarios
    const userResult = await database.query('SELECT id FROM users WHERE role = $1', ['user']);
    const userIds = userResult.rows.map(row => row.id);
    
    if (userIds.length === 0) {
      console.log('❌ No hay usuarios para crear cuestionarios');
      return;
    }
    
    const questionnaires = [
      {
        user_id: userIds[0],
        email: 'maria@ejemplo.com',
        type: 'pareja',
        personal_info: JSON.stringify({
          nombre: 'María',
          apellidos: 'García',
          edad: '28',
          genero: 'Femenino',
          correo: 'maria@ejemplo.com',
          orientacionSexual: 'Heterosexual'
        }),
        answers: JSON.stringify({
          "0": "Compañerismo y amor",
          "1": "Actividades juntos y conversaciones",
          "2": "Honestidad y respeto",
          "3": "Dialogando y buscando soluciones",
          "4": "Mejorar mi comunicación",
          "5": "Muy importante",
          "6": "Lo respeto y entiendo",
          "7": "Fundamental",
          "8": "Me alegro por su éxito",
          "9": "Importante pero no prioritario",
          "10": "Trabajando en la confianza",
          "11": "Muy importante",
          "12": "Con confianza y respeto",
          "13": "Importante para la independencia",
          "14": "Escuchando y respetando opiniones",
          "15": "Muy importante para la convivencia",
          "16": "Una relación de respeto mutuo y crecimiento"
        }),
        status: 'completed',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 días atrás
      },
      {
        user_id: userIds[1],
        email: 'juan@ejemplo.com',
        type: 'personalidad',
        personal_info: JSON.stringify({
          nombre: 'Juan',
          apellidos: 'López',
          edad: '32',
          genero: 'Masculino',
          correo: 'juan@ejemplo.com',
          orientacionSexual: 'Heterosexual'
        }),
        answers: JSON.stringify({
          "0": "Extrovertido",
          "1": "Intuitivo",
          "2": "Sentimental",
          "3": "Perceptivo",
          "4": "Me gusta estar con gente",
          "5": "Confío en mis corazonadas",
          "6": "Me preocupo por los sentimientos",
          "7": "Me gusta mantener opciones abiertas"
        }),
        status: 'completed',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 día atrás
      },
      {
        user_id: userIds[2],
        email: 'ana@ejemplo.com',
        type: 'pareja',
        personal_info: JSON.stringify({
          nombre: 'Ana',
          apellidos: 'Martínez',
          edad: '25',
          genero: 'Femenino',
          correo: 'ana@ejemplo.com',
          orientacionSexual: 'Bisexual'
        }),
        answers: JSON.stringify({
          "0": "Pasión y conexión emocional",
          "1": "Tiempo de calidad y intimidad",
          "2": "Inteligencia y sentido del humor",
          "3": "Evitando conflictos",
          "4": "Desarrollar mi autoestima",
          "5": "Esencial",
          "6": "Me siento insegura",
          "7": "Crítico",
          "8": "Me comparo con ella",
          "9": "Muy importante",
          "10": "Me cuesta controlarlos",
          "11": "Fundamental",
          "12": "Me siento amenazada",
          "13": "Muy importante",
          "14": "Me cuesta aceptar diferencias",
          "15": "Importante",
          "16": "Una relación apasionada y comprometida"
        }),
        status: 'completed',
        created_at: new Date().toISOString() // Hoy
      }
    ];
    
    for (const questionnaire of questionnaires) {
      const existingQuestionnaire = await database.query(
        'SELECT id FROM questionnaires WHERE email = $1 AND type = $2',
        [questionnaire.email, questionnaire.type]
      );
      
      if (existingQuestionnaire.rows.length === 0) {
        const result = await database.query(
          `INSERT INTO questionnaires (user_id, email, type, personal_info, answers, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            questionnaire.user_id,
            questionnaire.email,
            questionnaire.type,
            questionnaire.personal_info,
            questionnaire.answers,
            questionnaire.status,
            questionnaire.created_at
          ]
        );
        console.log(`✅ Cuestionario creado: ${questionnaire.type} para ${questionnaire.email} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`⏭️ Cuestionario ya existe: ${questionnaire.type} para ${questionnaire.email}`);
      }
    }
    
    // 3. Verificar datos insertados
    console.log('\n📊 Verificando datos insertados...');
    
    const userCount = await database.query('SELECT COUNT(*) as count FROM users');
    const questionnaireCount = await database.query('SELECT COUNT(*) as count FROM questionnaires');
    
    console.log(`👥 Total usuarios: ${userCount.rows[0].count}`);
    console.log(`📝 Total cuestionarios: ${questionnaireCount.rows[0].count}`);
    
    // Verificar cuestionarios por tipo
    const parejaCount = await database.query("SELECT COUNT(*) as count FROM questionnaires WHERE type = 'pareja'");
    const personalidadCount = await database.query("SELECT COUNT(*) as count FROM questionnaires WHERE type = 'personalidad'");
    
    console.log(`💕 Cuestionarios de pareja: ${parejaCount.rows[0].count}`);
    console.log(`🧠 Cuestionarios de personalidad: ${personalidadCount.rows[0].count}`);
    
    console.log('\n🎉 ¡Datos de ejemplo insertados exitosamente!');
    console.log('💡 Ahora el dashboard admin debería mostrar cuestionarios');
    
  } catch (error) {
    console.error('❌ Error insertando datos de ejemplo:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedData().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = seedData;
