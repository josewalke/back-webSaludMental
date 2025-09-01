#!/usr/bin/env node

/**
 * Script para corregir datos corruptos en la base de datos
 * - Limpia personalInfo malformado
 * - Corrige answers corruptos
 * - Establece valores por defecto para datos faltantes
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixCorruptedData() {
  console.log('🔧 Iniciando corrección de datos corruptos...');
  
  try {
    // Conectar a la base de datos
    await pool.connect();
    console.log('✅ Conectado a la base de datos');

    // Obtener todos los cuestionarios
    const result = await pool.query(`
      SELECT id, personal_info, answers, type, created_at
      FROM questionnaires
      ORDER BY created_at DESC
    `);

    console.log(`📊 Encontrados ${result.rows.length} cuestionarios`);

    for (const row of result.rows) {
      console.log(`\n🔍 Procesando cuestionario ID ${row.id}:`);
      console.log(`   - Tipo: ${row.type}`);
      console.log(`   - personal_info (raw): ${row.personal_info}`);
      console.log(`   - answers (raw): ${row.answers}`);

      let needsUpdate = false;
      let newPersonalInfo = {};
      let newAnswers = {};

      // Procesar personal_info
      try {
        newPersonalInfo = JSON.parse(row.personal_info || '{}');
        console.log(`   ✅ personal_info parseado correctamente`);
      } catch (e) {
        console.log(`   ❌ Error parseando personal_info: ${e.message}`);
        newPersonalInfo = {
          nombre: 'Usuario',
          apellidos: 'Desconocido',
          edad: 'N/A',
          genero: 'N/A',
          correo: 'N/A',
          orientacionSexual: 'N/A'
        };
        needsUpdate = true;
      }

      // Verificar si personalInfo tiene todos los campos necesarios
      const requiredFields = ['nombre', 'apellidos', 'edad', 'genero', 'correo', 'orientacionSexual'];
      for (const field of requiredFields) {
        if (!newPersonalInfo[field] || newPersonalInfo[field] === '') {
          console.log(`   ⚠️ Campo faltante: ${field}`);
          newPersonalInfo[field] = field === 'nombre' ? 'Usuario' : 
                                  field === 'apellidos' ? 'Desconocido' : 'N/A';
          needsUpdate = true;
        }
      }

      // Procesar answers
      try {
        newAnswers = JSON.parse(row.answers || '{}');
        console.log(`   ✅ answers parseado correctamente`);
        
        // Verificar si answers tiene error
        if (newAnswers.error === 'Error parseando respuestas') {
          console.log(`   ⚠️ answers tiene error, estableciendo respuestas vacías`);
          newAnswers = {};
          needsUpdate = true;
        }
      } catch (e) {
        console.log(`   ❌ Error parseando answers: ${e.message}`);
        newAnswers = {};
        needsUpdate = true;
      }

      // Actualizar si es necesario
      if (needsUpdate) {
        console.log(`   🔄 Actualizando cuestionario ID ${row.id}...`);
        
        await pool.query(`
          UPDATE questionnaires 
          SET 
            personal_info = $1,
            answers = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(newPersonalInfo),
          JSON.stringify(newAnswers),
          row.id
        ]);
        
        console.log(`   ✅ Cuestionario ID ${row.id} actualizado`);
      } else {
        console.log(`   ✅ Cuestionario ID ${row.id} no necesita actualización`);
      }
    }

    console.log('\n🎉 Corrección de datos completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixCorruptedData()
    .then(() => {
      console.log('✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixCorruptedData };
