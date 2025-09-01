#!/usr/bin/env node

// Script de prueba para verificar el servidor
console.log('🧪 Probando servidor...');

try {
  console.log('📦 Importando servidor...');
  require('./src/server.js');
  console.log('✅ Servidor importado correctamente');
} catch (error) {
  console.error('❌ Error importando servidor:', error);
  process.exit(1);
}
