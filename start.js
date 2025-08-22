#!/usr/bin/env node

/**
 * Archivo de entrada principal para Render
 * Incluye migración automática y inicio del servidor
 */

console.log('🚀 Iniciando Web Salud Mental Backend...');
console.log('🌍 Entorno:', process.env.NODE_ENV || 'development');
console.log('⏰ Hora:', new Date().toISOString());

// Función para ejecutar migración
const runMigration = async () => {
  try {
    console.log('🗄️ Ejecutando migración automática...');
    
    // Importar y ejecutar migración
    const { createTables } = require('./scripts/migrate.js');
    await createTables();
    console.log('✅ Migración completada exitosamente');
    return true;
  } catch (error) {
    console.warn('⚠️ Advertencia: La migración falló:', error.message);
    console.warn('💡 Esto puede ser normal si las tablas ya existen');
    return false;
  }
};

// Función principal
const main = async () => {
  try {
    // 1. Verificar si estamos en producción (Render)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      console.log('🌍 Entorno de producción detectado (Render)');
      
      // Ejecutar migración
      await runMigration();
    } else {
      console.log('🏠 Entorno de desarrollo detectado');
      console.log('⏭️ Saltando migración automática');
    }

    // 2. Iniciar el servidor
    console.log('🚀 Iniciando servidor...');
    
    // Importar y ejecutar el servidor
    require('./src/server.js');
    
  } catch (error) {
    console.error('💥 Error durante el inicio:', error);
    process.exit(1);
  }
};

// Ejecutar
main().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
