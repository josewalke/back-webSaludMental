# 🚀 **Deploy en Render - Web Salud Mental Backend**

## �� **Configuración necesaria:**

### **1. 🐘 Base de datos PostgreSQL:**
- **Servicio**: PostgreSQL (no Web Service)
- **Plan**: Free
- **Nombre**: websaludmental-db
- **Región**: Oregon (US West)

### **2. ⚙️ Variables de entorno en Web Service:**
```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://websaludmental_db_user:password@hostname:port/database
JWT_SECRET=websaludmental_jwt_secret_2024_super_seguro
CORS_ORIGIN=https://tu-frontend.netlify.app
ADMIN_EMAIL=admin@websaludmental.com
ADMIN_PASSWORD=admin123
```

### **3. 🔗 Conexión a base de datos:**
- **Tipo**: Web Service (Node.js)
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Auto-Deploy**: Sí

## 🗄️ **Migración de base de datos:**

### **Opción A: Automática (recomendada)**
El script se ejecutará automáticamente en el primer deploy.

### **Opción B: Manual**
```bash
npm run db:migrate
```

## ✅ **Verificación:**
1. Base de datos PostgreSQL "Active"
2. Web Service conectado a PostgreSQL
3. Variables de entorno configuradas
4. Deploy exitoso

## 🔧 **Comandos útiles:**
```bash
# Ver logs
npm run dev

# Migrar base de datos
npm run db:migrate

# Probar conexión
npm run db:test
```
