#!/usr/bin/env node

/**
 * Script para limpiar cuestionarios con datos corruptos
 * Elimina cuestionarios que tienen [object Object] en las respuestas
 */

require('dotenv').config();
const database = require('../src/config/database');

async function cleanCorruptedData() {
  try {
    console.log('🧹 Iniciando limpieza de datos corruptos...');

    // Verificar conexión
    const testResult = await database.query('SELECT 1 as test');
    console.log('✅ Conexión a base de datos exitosa');

    // 1. Verificar cuestionarios existentes
    console.log('📊 Verificando cuestionarios existentes...');
    const questionnaires = await database.query('SELECT id, answers FROM questionnaires');
    console.log(`📝 Total cuestionarios encontrados: ${questionnaires.rows.length}`);

    // 2. Identificar cuestionarios corruptos
    const corruptedIds = [];
    questionnaires.rows.forEach(row => {
      try {
        const answers = JSON.parse(row.answers);
        // Verificar si alguna respuesta contiene [object Object]
        const hasCorruptedData = Object.values(answers).some(answer => 
          String(answer).includes('[object Object]')
        );
        if (hasCorruptedData) {
          corruptedIds.push(row.id);
          console.log(`❌ Cuestionario ${row.id} tiene datos corruptos`);
        }
      } catch (error) {
        corruptedIds.push(row.id);
        console.log(`❌ Cuestionario ${row.id} tiene JSON inválido`);
      }
    });

    if (corruptedIds.length === 0) {
      console.log('✅ No se encontraron cuestionarios corruptos');
      return;
    }

    console.log(`🗑️ Cuestionarios a eliminar: ${corruptedIds.join(', ')}`);

    // 3. Eliminar cuestionarios corruptos
    console.log('🗑️ Eliminando cuestionarios corruptos...');
    for (const id of corruptedIds) {
      await database.query('DELETE FROM questionnaires WHERE id = $1', [id]);
      console.log(`✅ Cuestionario ${id} eliminado`);
    }

    // 4. Verificar resultado
    const remainingQuestionnaires = await database.query('SELECT COUNT(*) as count FROM questionnaires');
    console.log(`📊 Cuestionarios restantes: ${remainingQuestionnaires.rows[0].count}`);

    console.log('\n🎉 ¡Limpieza completada exitosamente!');
    console.log('💡 Ahora el dashboard admin debería funcionar sin errores');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanCorruptedData().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = cleanCorruptedData;
