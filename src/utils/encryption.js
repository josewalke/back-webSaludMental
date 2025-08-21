const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Utilidades de Encriptación y Hashing Avanzado
 * Protección de nivel empresarial para datos sensibles
 */

// Configuración de encriptación
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  saltRounds: 12,
  pepper: process.env.ENCRYPTION_PEPPER || 'default_pepper_change_in_production'
};

/**
 * Generar clave de encriptación segura
 */
function generateEncryptionKey(password, salt) {
  return crypto.pbkdf2Sync(
    password + ENCRYPTION_CONFIG.pepper,
    salt,
    100000, // 100,000 iteraciones
    ENCRYPTION_CONFIG.keyLength,
    'sha512'
  );
}

/**
 * Encriptar datos sensibles
 */
function encryptData(data, masterKey) {
  try {
    if (!data || !masterKey) {
      throw new Error('Datos y clave maestra son requeridos');
    }

    // Generar IV único
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    
    // Generar salt único
    const salt = crypto.randomBytes(16);
    
    // Generar clave de encriptación
    const key = generateEncryptionKey(masterKey, salt);
    
    // Crear cipher
    const cipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, key);
    cipher.setAutoPadding(true);
    
    // Encriptar datos
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Obtener auth tag
    const authTag = cipher.getAuthTag();
    
    // Combinar todos los componentes
    const encryptedData = {
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: ENCRYPTION_CONFIG.algorithm
    };
    
    return JSON.stringify(encryptedData);
  } catch (error) {
    console.error('Error encriptando datos:', error);
    throw new Error('Error de encriptación');
  }
}

/**
 * Desencriptar datos
 */
function decryptData(encryptedData, masterKey) {
  try {
    if (!encryptedData || !masterKey) {
      throw new Error('Datos encriptados y clave maestra son requeridos');
    }

    // Parsear datos encriptados
    const data = JSON.parse(encryptedData);
    
    // Extraer componentes
    const { encrypted, iv, salt, authTag, algorithm } = data;
    
    // Verificar algoritmo
    if (algorithm !== ENCRYPTION_CONFIG.algorithm) {
      throw new Error('Algoritmo de encriptación no soportado');
    }
    
    // Generar clave de desencriptación
    const key = generateEncryptionKey(masterKey, Buffer.from(salt, 'hex'));
    
    // Crear decipher
    const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.algorithm, key);
    decipher.setAutoPadding(true);
    
    // Establecer auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Desencriptar datos
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando datos:', error);
    throw new Error('Error de desencriptación');
  }
}

/**
 * Hash seguro de contraseñas con salt y pepper
 */
async function hashPassword(password) {
  try {
    if (!password || password.length < 8) {
      throw new Error('Contraseña debe tener al menos 8 caracteres');
    }
    
    // Agregar pepper a la contraseña
    const pepperedPassword = password + ENCRYPTION_CONFIG.pepper;
    
    // Generar hash con bcrypt
    const hashedPassword = await bcrypt.hash(pepperedPassword, ENCRYPTION_CONFIG.saltRounds);
    
    return hashedPassword;
  } catch (error) {
    console.error('Error hasheando contraseña:', error);
    throw new Error('Error de hash de contraseña');
  }
}

/**
 * Verificar contraseña
 */
async function verifyPassword(password, hashedPassword) {
  try {
    if (!password || !hashedPassword) {
      return false;
    }
    
    // Agregar pepper a la contraseña
    const pepperedPassword = password + ENCRYPTION_CONFIG.pepper;
    
    // Verificar con bcrypt
    const isValid = await bcrypt.compare(pepperedPassword, hashedPassword);
    
    return isValid;
  } catch (error) {
    console.error('Error verificando contraseña:', error);
    return false;
  }
}

/**
 * Generar token seguro aleatorio
 */
function generateSecureToken(length = 32) {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    console.error('Error generando token seguro:', error);
    throw new Error('Error generando token');
  }
}

/**
 * Generar UUID v4 seguro
 */
function generateSecureUUID() {
  try {
    return crypto.randomUUID();
  } catch (error) {
    // Fallback para versiones antiguas de Node.js
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * Hash de datos para verificación de integridad
 */
function generateDataHash(data) {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  } catch (error) {
    console.error('Error generando hash de datos:', error);
    throw new Error('Error generando hash');
  }
}

/**
 * Verificar integridad de datos
 */
function verifyDataIntegrity(data, expectedHash) {
  try {
    const actualHash = generateDataHash(data);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Error verificando integridad:', error);
    return false;
  }
}

/**
 * Encriptar datos del cuestionario de manera segura
 */
function encryptQuestionnaireData(data, userEmail) {
  try {
    // Usar email del usuario como parte de la clave
    const masterKey = userEmail + ENCRYPTION_CONFIG.pepper;
    
    // Encriptar datos sensibles
    const encryptedData = {
      personalInfo: encryptData(JSON.stringify(data.personalInfo), masterKey),
      answers: encryptData(JSON.stringify(data.answers), masterKey),
      metadata: {
        encryptedAt: new Date().toISOString(),
        algorithm: ENCRYPTION_CONFIG.algorithm,
        dataHash: generateDataHash(data)
      }
    };
    
    return encryptedData;
  } catch (error) {
    console.error('Error encriptando datos del cuestionario:', error);
    throw new Error('Error de encriptación del cuestionario');
  }
}

/**
 * Desencriptar datos del cuestionario
 */
function decryptQuestionnaireData(encryptedData, userEmail) {
  try {
    // Usar email del usuario como parte de la clave
    const masterKey = userEmail + ENCRYPTION_CONFIG.pepper;
    
    // Desencriptar datos
    const decryptedData = {
      personalInfo: JSON.parse(decryptData(encryptedData.personalInfo, masterKey)),
      answers: JSON.parse(decryptData(encryptedData.answers, masterKey))
    };
    
    // Verificar integridad
    if (encryptedData.metadata && encryptedData.metadata.dataHash) {
      const actualHash = generateDataHash(decryptedData);
      if (actualHash !== encryptedData.metadata.dataHash) {
        throw new Error('Integridad de datos comprometida');
      }
    }
    
    return decryptedData;
  } catch (error) {
    console.error('Error desencriptando datos del cuestionario:', error);
    throw new Error('Error de desencriptación del cuestionario');
  }
}

/**
 * Limpiar datos sensibles de la memoria
 */
function secureCleanup(data) {
  try {
    if (typeof data === 'string') {
      // Sobrescribir string con caracteres aleatorios
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (let i = 0; i < data.length; i++) {
        data = data.substring(0, i) + chars[Math.floor(Math.random() * chars.length)] + data.substring(i + 1);
      }
    } else if (typeof data === 'object') {
      // Limpiar propiedades del objeto
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
          data[key] = '***CLEANED***';
        }
      });
    }
  } catch (error) {
    console.error('Error en limpieza segura:', error);
  }
}

module.exports = {
  encryptData,
  decryptData,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateSecureUUID,
  generateDataHash,
  verifyDataIntegrity,
  encryptQuestionnaireData,
  decryptQuestionnaireData,
  secureCleanup,
  ENCRYPTION_CONFIG
};
