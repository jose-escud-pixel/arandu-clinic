# Arandu Clinic - Sistema de Gestión Traumatológica

Sistema completo de gestión para consultorios traumatológicos desarrollado con React, FastAPI y MongoDB.

## 🚀 Características

- ✅ Autenticación JWT para médicos
- ✅ Gestión completa de pacientes (CRUD)
- ✅ Sistema de citas y turnos
- ✅ Historial de consultas médicas
- ✅ **Recetas médicas en PDF** (imprimibles con diagnóstico, medicamentos e instrucciones)
- ✅ Carga de archivos/radiografías
- ✅ **Estadísticas avanzadas con gráficos** (evolución de pacientes, diagnósticos comunes)
- ✅ Recordatorios automáticos de citas próximas
- ✅ Exportación de historiales clínicos completos en PDF
- ✅ Diseño moderno y amigable con colores cálidos

## 📋 Requisitos del Servidor

- **Node.js** 18+ (para React)
- **Python** 3.11+ (para FastAPI)
- **MongoDB** 5.0+
- **Apache** o **Nginx**
- **PM2** (para gestión de procesos)

## 🔧 Instalación Rápida

### 1. Clonar el repositorio

\`\`\`bash
git clone https://github.com/TU-USUARIO/arandu-clinic.git
cd arandu-clinic
\`\`\`

### 2. Configurar Backend

\`\`\`bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\\Scripts\\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con tus valores
\`\`\`

### 3. Configurar Frontend

\`\`\`bash
cd frontend

# Instalar dependencias
yarn install

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con tu dominio

# Compilar para producción
yarn build
\`\`\`

### 4. Iniciar Backend con PM2

\`\`\`bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar el backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
\`\`\`

### 5. Configurar Apache

Ver guía completa en [DEPLOYMENT_UBUNTU.md](./DEPLOYMENT_UBUNTU.md)

## 📚 Documentación Completa

- **[Guía de Deployment en Ubuntu](./DEPLOYMENT_UBUNTU.md)** - Instrucciones paso a paso
- **Configuración de Apache** - Ver sección en DEPLOYMENT_UBUNTU.md
- **API Documentation** - Backend usa FastAPI (ver `/api/docs` cuando esté corriendo)

## 🛠️ Desarrollo Local

### Backend
\`\`\`bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --port 8001
\`\`\`

### Frontend
\`\`\`bash
cd frontend
yarn start
\`\`\`

Visita: http://localhost:3000

## 📦 Estructura del Proyecto

\`\`\`
arandu-clinic/
├── backend/
│   ├── server.py              # API FastAPI principal
│   ├── requirements.txt       # Dependencias Python
│   └── .env.example           # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── pages/            # Páginas React
│   │   ├── components/       # Componentes reutilizables
│   │   └── lib/              # Utilidades y API client
│   ├── package.json
│   └── .env.example
├── ecosystem.config.js        # Configuración PM2
└── DEPLOYMENT_UBUNTU.md       # Guía de deployment
\`\`\`

## 🔐 Seguridad

⚠️ **IMPORTANTE**: Antes de poner en producción:

1. Cambia el `JWT_SECRET` en `backend/.env`
2. Configura CORS correctamente (no usar `*` en producción)
3. Activa HTTPS con Let's Encrypt
4. Configura autenticación en MongoDB

## 📝 Variables de Entorno

### Backend (.env)
\`\`\`
MONGO_URL=mongodb://localhost:27017
DB_NAME=arandu_clinic_db
JWT_SECRET=tu-clave-super-segura-aqui
CORS_ORIGINS=*
\`\`\`

### Frontend (.env)
\`\`\`
REACT_APP_BACKEND_URL=https://www.tudominio.com
PUBLIC_URL=/arandu-clinic
\`\`\`

## 🐛 Solución de Problemas

### Backend no inicia
\`\`\`bash
pm2 logs arandu-backend
\`\`\`

### Frontend no carga
\`\`\`bash
sudo tail -f /var/log/apache2/error.log
\`\`\`

### MongoDB no conecta
\`\`\`bash
sudo systemctl status mongod
mongosh  # Probar conexión
\`\`\`

## 🤝 Contribuciones

Este es un proyecto privado para Arandu Informática.

## 📄 Licencia

Propietario: Arandu Informática - Todos los derechos reservados.

## 📧 Soporte

Para soporte técnico, contactar a: soporte@aranduinformatica.net

---

Desarrollado con ❤️ por Arandu Informática
