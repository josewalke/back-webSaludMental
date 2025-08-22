#!/usr/bin/env node

/**
 * Archivo específico para Render
 * Incluye migración automática y inicio del servidor
 */

console.log('🚀 Iniciando Web Salud Mental Backend en Render...');
console.log('🌍 Entorno:', process.env.NODE_ENV || 'development');
console.log('⏰ Hora:', new Date().toISOString());

// Función para ejecutar migración
const runMigration = async () => {
  try {
    console.log('🗄️ Ejecutando migración automática en Render...');
    
    // Importar y ejecutar migración
    const { createTables } = require('./scripts/migrate.js');
    await createTables();
    console.log('✅ Migración completada exitosamente en Render');
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
    console.log('🌍 Entorno de producción detectado (Render)');
    
    // Ejecutar migración
    await runMigration();
    
    // Iniciar el servidor
    console.log('🚀 Iniciando servidor después de migración...');
    
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
