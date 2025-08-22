#!/usr/bin/env node

/**
 * Script de inicio que ejecuta migración automáticamente
 * Para Render (versión gratuita)
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor con migración automática...');

// Función para ejecutar comandos
const runCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
};

// Función principal
const main = async () => {
  try {
    // 1. Verificar si estamos en producción (Render)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      console.log('🌍 Entorno de producción detectado (Render)');
      console.log('🗄️ Ejecutando migración automática...');
      
      try {
        // Ejecutar migración
        await runCommand('npm', ['run', 'db:migrate']);
        console.log('✅ Migración completada exitosamente');
      } catch (migrationError) {
        console.warn('⚠️ Advertencia: La migración falló, pero continuando...');
        console.warn('💡 Esto puede ser normal si las tablas ya existen');
      }
    } else {
      console.log('🏠 Entorno de desarrollo detectado');
      console.log('⏭️ Saltando migración automática');
    }

    // 2. Iniciar el servidor
    console.log('🚀 Iniciando servidor...');
    await runCommand('node', ['src/server.js']);
    
  } catch (error) {
    console.error('💥 Error durante el inicio:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = main;
