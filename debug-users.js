#!/usr/bin/env node

/**
 * Script de debug para verificar usuarios en la base de datos
 */

require('dotenv').config();
const database = require('./src/config/database');

async function debugUsers() {
  try {
    console.log('🔍 Debug: Verificando usuarios en la base de datos...');
    console.log('🌍 Entorno:', process.env.NODE_ENV);
    console.log('🐘 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurado' : 'No configurado');
    
    // Verificar conexión
    const testResult = await database.query('SELECT 1 as test');
    console.log('✅ Conexión a BD exitosa');
    
    // Verificar estructura de la tabla users
    console.log('\n📋 Estructura de la tabla users:');
    const tableInfo = await database.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verificar usuarios existentes
    console.log('\n👥 Usuarios existentes:');
    const users = await database.query('SELECT id, email, name, role, created_at FROM users;');
    
    if (users.rows.length === 0) {
      console.log('   ❌ No hay usuarios en la tabla');
    } else {
      users.rows.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}, Name: ${user.name}, Role: ${user.role}`);
      });
    }
    
    // Verificar usuario admin específico
    console.log('\n🔐 Verificando usuario admin específico:');
    const adminUser = await database.query(
      'SELECT * FROM users WHERE email = $1',
      ['admin@websaludmental.com']
    );
    
    if (adminUser.rows.length === 0) {
      console.log('   ❌ Usuario admin@websaludmental.com NO encontrado');
    } else {
      const admin = adminUser.rows[0];
      console.log('   ✅ Usuario admin encontrado:');
      console.log(`      - ID: ${admin.id}`);
      console.log(`      - Email: ${admin.email}`);
      console.log(`      - Name: ${admin.name}`);
      console.log(`      - Role: ${admin.role}`);
      console.log(`      - Password hash: ${admin.password ? 'SÍ' : 'NO'}`);
      console.log(`      - Password length: ${admin.password ? admin.password.length : 0}`);
    }
    
  } catch (error) {
    console.error('💥 Error en debug:', error);
  } finally {
    process.exit(0);
  }
}

debugUsers();
