# 🚀 Backend - Nueva Web Salud Mental

## 📋 **Descripción**
Backend API profesional para la aplicación de salud mental construido con **Node.js**, **Express** y **SQLite**.

## 🏗️ **Arquitectura**

### **Stack Tecnológico:**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Base de datos**: SQLite3
- **Autenticación**: JWT + bcrypt
- **Validación**: Joi
- **Seguridad**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan + Logger personalizado
- **Auditoría**: Sistema completo de logs

### **Estructura de Carpetas:**
```
backend/
├── src/
│   ├── database/          # Conexión y configuración de BD
│   ├── middleware/        # Middlewares personalizados
│   ├── routes/            # Rutas de la API
│   ├── models/            # Modelos de datos
│   ├── utils/             # Utilidades y helpers
│   └── server.js          # Servidor principal
├── database.sqlite        # Base de datos SQLite
├── package.json           # Dependencias y scripts
└── README.md              # Este archivo
```

## ⚙️ **Instalación**

### **1. Prerrequisitos:**
- Node.js 18.0.0 o superior
- npm 8.0.0 o superior

### **2. Instalación:**
```bash
# Navegar al directorio del backend
cd backend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env

# Configurar variables en .env (ver sección de configuración)
```

### **3. Configuración de Variables de Entorno:**
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus valores
nano .env
```

**Variables importantes:**
- `JWT_SECRET`: Secret para JWT (cambiar en producción)
- `PORT`: Puerto del servidor (default: 3001)
- `NODE_ENV`: Entorno (development/production)
- `CORS_ORIGIN`: Origen permitido para CORS

### **4. Inicializar Base de Datos:**
```bash
# Crear tablas y datos iniciales
npm run db:init

# Opcional: Insertar datos de prueba
npm run db:seed
```

## 🚀 **Uso**

### **Desarrollo:**
```bash
# Iniciar servidor en modo desarrollo
npm run dev

# El servidor estará disponible en:
# http://localhost:3001
```

### **Producción:**
```bash
# Construir aplicación
npm run build

# Iniciar servidor
npm start
```

### **Scripts Disponibles:**
```bash
npm run dev          # Desarrollo con nodemon
npm start            # Producción
npm run db:init      # Inicializar base de datos
npm run db:seed      # Insertar datos de prueba
npm test             # Ejecutar tests
npm run lint         # Verificar código
npm run lint:fix     # Corregir problemas de linting
```

## 🔐 **Autenticación**

### **Endpoints de Autenticación:**
```
POST /api/auth/register          # Registro de usuario
POST /api/auth/login             # Login
POST /api/auth/refresh           # Renovar token
POST /api/auth/logout            # Logout
GET  /api/auth/me                # Perfil del usuario
PUT  /api/auth/me                # Actualizar perfil
POST /api/auth/change-password   # Cambiar contraseña
GET  /api/auth/sessions          # Sesiones activas
```

### **Uso de JWT:**
```bash
# Incluir token en headers
Authorization: Bearer <tu_token_jwt>

# Ejemplo de request
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     http://localhost:3001/api/auth/me
```

## 📊 **Base de Datos**

### **Tablas Principales:**
- **users**: Usuarios del sistema
- **questionnaires**: Cuestionarios de salud mental
- **sessions**: Sesiones de usuario
- **audit_logs**: Logs de auditoría
- **system_config**: Configuración del sistema
- **system_stats**: Estadísticas del sistema

### **Inicialización:**
```bash
# Crear todas las tablas
npm run db:init

# Verificar estado
curl http://localhost:3001/system/info
```

### **Backup y Restauración:**
```bash
# Backup de la base de datos
cp database.sqlite database.sqlite.backup

# Restaurar desde backup
cp database.sqlite.backup database.sqlite
```

## 🔒 **Seguridad**

### **Características Implementadas:**
- ✅ **Helmet**: Headers de seguridad
- ✅ **CORS**: Control de acceso entre dominios
- ✅ **Rate Limiting**: Protección contra spam
- ✅ **JWT**: Autenticación stateless
- ✅ **bcrypt**: Encriptación de contraseñas
- ✅ **Validación**: Joi para validar entrada
- ✅ **Auditoría**: Logs de todas las acciones
- ✅ **SQL Injection**: Prevención con parámetros

### **Configuración de Seguridad:**
```javascript
// Rate limiting: 100 requests por 15 minutos
// JWT expiration: 24 horas
// bcrypt rounds: 12
// CORS: Solo origen configurado
```

## 📈 **Monitoreo y Logs**

### **Endpoints de Monitoreo:**
```
GET /health              # Estado del servidor
GET /system/info         # Información del sistema
```

### **Logs Disponibles:**
- **Requests**: Todos los requests HTTP
- **Errores**: Errores y excepciones
- **Auditoría**: Acciones de usuarios
- **Performance**: Requests lentos
- **Seguridad**: Intentos de acceso

### **Ejemplo de Log:**
```
📥 [uuid] POST /api/auth/login - 127.0.0.1
🟢 [uuid] POST /api/auth/login - 200 (45ms)
   📊 Request ID: uuid
   ⏱️  Duración: 45ms
   📍 IP: 127.0.0.1
   👤 Usuario: Juan Pérez (1)
```

## 🧪 **Testing**

### **Ejecutar Tests:**
```bash
# Tests unitarios
npm test

# Tests en modo watch
npm run test:watch

# Cobertura de código
npm run test:coverage
```

### **Tests Disponibles:**
- Tests de autenticación
- Tests de validación
- Tests de base de datos
- Tests de middleware
- Tests de integración

## 📚 **API Documentation**

### **Swagger/OpenAPI:**
```bash
# Documentación disponible en:
http://localhost:3001/api/docs
```

### **Endpoints Principales:**

#### **Autenticación:**
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Perfil

#### **Cuestionarios:**
- `GET /api/questionnaires` - Listar
- `POST /api/questionnaires` - Crear
- `PUT /api/questionnaires/:id` - Actualizar
- `DELETE /api/questionnaires/:id` - Eliminar

#### **Analytics:**
- `GET /api/analytics/summary` - Resumen
- `GET /api/analytics/demographics` - Demografía
- `POST /api/analytics/export` - Exportar datos

## 🚀 **Despliegue**

### **Entorno Local:**
```bash
npm run dev
# Servidor en http://localhost:3001
```

### **Entorno de Producción:**
```bash
# Configurar variables de entorno
export NODE_ENV=production
export JWT_SECRET=secret_super_seguro_y_largo

# Iniciar servidor
npm start
```

### **Docker (Opcional):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🔧 **Mantenimiento**

### **Tareas Programadas:**
- Limpieza de sesiones expiradas
- Limpieza de logs antiguos
- Actualización de estadísticas
- Backup automático de base de datos

### **Monitoreo:**
- Uso de memoria y CPU
- Tiempo de respuesta de API
- Errores y excepciones
- Uso de base de datos

## 🆘 **Soporte y Troubleshooting**

### **Problemas Comunes:**

#### **1. Error de Conexión a Base de Datos:**
```bash
# Verificar que la base de datos existe
ls -la database.sqlite

# Recrear base de datos
rm database.sqlite
npm run db:init
```

#### **2. Error de JWT:**
```bash
# Verificar variable JWT_SECRET
echo $JWT_SECRET

# Regenerar secret
export JWT_SECRET=$(openssl rand -base64 32)
```

#### **3. Error de CORS:**
```bash
# Verificar CORS_ORIGIN en .env
# Debe coincidir con tu frontend
```

### **Logs de Debug:**
```bash
# Habilitar logs detallados
export LOG_LEVEL=debug

# Ver logs en tiempo real
tail -f logs/app.log
```

## 📞 **Contacto y Soporte**

- **Desarrollador**: Jose Juan Perez Gonzalez
- **Repositorio**: https://github.com/josewalke/Web-Salud-mental
- **Documentación**: Este README + código fuente

## 📄 **Licencia**

MIT License - Ver archivo LICENSE para más detalles.

---

**⚠️ IMPORTANTE:** 
- Nunca subir archivos `.env` a Git
- Cambiar `JWT_SECRET` en producción
- Configurar `CORS_ORIGIN` correctamente
- Hacer backup regular de la base de datos
