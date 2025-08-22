#!/usr/bin/env node

/**
 * Script temporal para debug de la base de datos
 * Se puede ejecutar localmente o en Render
 */

require('dotenv').config();
const database = require('./src/config/database');

async function debugDatabase() {
  try {
    console.log('🔍 DEBUG: Verificando estado de la base de datos...');
    console.log('📍 Entorno:', process.env.NODE_ENV || 'development');
    console.log('🔗 Database URL:', process.env.DATABASE_URL ? 'Configurado' : 'No configurado');
    
    // 1. Verificar conexión
    console.log('\n1️⃣ Probando conexión...');
    const connectionTest = await database.query('SELECT 1 as test, NOW() as timestamp');
    console.log('✅ Conexión a BD exitosa');
    console.log('⏰ Timestamp BD:', connectionTest.rows[0].timestamp);
    
    // 2. Verificar tablas existentes
    console.log('\n2️⃣ Verificando tablas...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tables = await database.query(tablesQuery);
    console.log('📋 Tablas encontradas:', tables.rows.map(t => t.table_name));
    
    // 3. Verificar usuarios
    console.log('\n3️⃣ Verificando usuarios...');
    let usersCount = 0;
    let adminUser = null;
    try {
      const usersResult = await database.query('SELECT COUNT(*) as count FROM users');
      usersCount = parseInt(usersResult.rows[0].count);
      console.log('👥 Total usuarios:', usersCount);
      
      if (usersCount > 0) {
        const adminResult = await database.query('SELECT id, email, role FROM users WHERE role = $1', ['admin']);
        if (adminResult.rows.length > 0) {
          adminUser = adminResult.rows[0];
          console.log('👑 Usuario admin:', { id: adminUser.id, email: adminUser.email });
        } else {
          console.log('⚠️ No se encontró usuario admin');
        }
      }
    } catch (error) {
      console.log('❌ Error verificando usuarios:', error.message);
    }
    
    // 4. Verificar cuestionarios
    console.log('\n4️⃣ Verificando cuestionarios...');
    let questionnairesCount = 0;
    let corruptedCount = 0;
    let sampleQuestionnaires = [];
    
    try {
      const questionnairesResult = await database.query('SELECT COUNT(*) as count FROM questionnaires');
      questionnairesCount = parseInt(questionnairesResult.rows[0].count);
      console.log('📝 Total cuestionarios:', questionnairesCount);
      
      if (questionnairesCount > 0) {
        // Obtener muestra de cuestionarios
        const sampleResult = await database.query(`
          SELECT id, type, email, status, created_at, 
                 CASE 
                   WHEN answers IS NULL THEN 'NULL'
                   WHEN answers = '' THEN 'EMPTY'
                   WHEN answers = '{}' THEN 'EMPTY_OBJECT'
                   ELSE 'HAS_DATA'
                 END as answers_status,
                 LEFT(answers::text, 100) as answers_preview
          FROM questionnaires 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        sampleQuestionnaires = sampleResult.rows;
        
        console.log('📊 Muestra de cuestionarios:');
        sampleQuestionnaires.forEach(q => {
          console.log(`  ID ${q.id}: ${q.type} - ${q.email} - ${q.status} - ${q.answers_status}`);
          if (q.answers_preview && q.answers_preview !== 'NULL' && q.answers_preview !== 'EMPTY') {
            console.log(`    Preview: ${q.answers_preview}`);
          }
        });
        
        // Verificar cuestionarios corruptos
        console.log('\n🔍 Verificando cuestionarios corruptos...');
        const allQuestionnaires = await database.query('SELECT id, answers FROM questionnaires');
        allQuestionnaires.rows.forEach(row => {
          try {
            if (row.answers && row.answers !== '{}' && row.answers !== '') {
              const parsed = JSON.parse(row.answers);
              if (typeof parsed === 'object' && parsed !== null) {
                const hasCorruptedData = Object.values(parsed).some(answer => 
                  String(answer).includes('[object Object]')
                );
                if (hasCorruptedData) {
                  corruptedCount++;
                  console.log(`❌ Cuestionario ${row.id} tiene datos corruptos`);
                }
              }
            }
          } catch (error) {
            corruptedCount++;
            console.log(`❌ Cuestionario ${row.id} tiene JSON inválido: ${error.message}`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Error verificando cuestionarios:', error.message);
    }
    
    // 5. Resumen del estado
    console.log('\n📊 RESUMEN DEL ESTADO:');
    console.log('=====================================');
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Base de datos: Conectada`);
    console.log(`📋 Tablas: ${tables.rows.length}`);
    console.log(`👥 Usuarios: ${usersCount}`);
    console.log(`📝 Cuestionarios: ${questionnairesCount}`);
    console.log(`❌ Corruptos: ${corruptedCount}`);
    console.log(`✅ Sanos: ${questionnairesCount - corruptedCount}`);
    
    if (corruptedCount > 0) {
      console.log('\n🚨 RECOMENDACIONES:');
      console.log(`   - Limpiar ${corruptedCount} cuestionarios corruptos`);
      console.log('   - Ejecutar: npm run db:clean');
    }
    
    if (questionnairesCount === 0) {
      console.log('\n💡 RECOMENDACIONES:');
      console.log('   - No hay cuestionarios. Crear algunos para probar');
      console.log('   - Ejecutar: npm run db:seed');
    }
    
    console.log('\n🎉 Debug completado exitosamente!');
    
  } catch (error) {
    console.error('💥 Error fatal durante debug:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  debugDatabase().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = debugDatabase;
