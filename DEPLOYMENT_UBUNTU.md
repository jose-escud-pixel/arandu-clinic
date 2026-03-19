# Guía de Deployment para Arandu Clinic en Ubuntu 24.04

## ⚠️ Importante: Requisitos del Stack

Esta aplicación **NO** usa el stack LAMP tradicional (Linux, Apache, MySQL, PHP). En su lugar usa:
- **Frontend**: React (Node.js)
- **Backend**: Python FastAPI
- **Base de Datos**: MongoDB (no MySQL)

## Requisitos del Servidor

Tu servidor Ubuntu 24.04 necesitará:

1. **Node.js 20+** (para el frontend React)
2. **Python 3.11+** (para el backend FastAPI)
3. **MongoDB** (para la base de datos)
4. **Nginx** (como proxy reverso, reemplaza Apache)
5. **PM2** (para mantener los procesos corriendo)

## Pasos de Instalación

### 1. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verificar instalación
```

### 2. Instalar Python 3.11

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip
python3.11 --version  # Verificar instalación
```

### 3. Instalar MongoDB

```bash
# Importar la clave pública de MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Crear el archivo de lista para MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Actualizar e instalar MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

### 4. Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
sudo npm install -g yarn
```

## Deployment de la Aplicación

### 1. Clonar o subir tu código al servidor

```bash
# En tu servidor
cd /var/www
sudo mkdir arandu-clinic
sudo chown $USER:$USER arandu-clinic
cd arandu-clinic

# Subir archivos usando scp, git, o tu método preferido
# O usar git:
# git clone <tu-repositorio>
```

### 2. Configurar el Backend

```bash
cd /var/www/arandu-clinic/backend

# Crear entorno virtual
python3.11 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="arandu_clinic_prod"
CORS_ORIGINS="*"
JWT_SECRET="tu-clave-secreta-segura-aqui"
EOF

# Desactivar entorno virtual
deactivate
```

### 3. Configurar el Frontend

```bash
cd /var/www/arandu-clinic/frontend

# Instalar dependencias
yarn install

# Crear archivo .env para producción
cat > .env << EOF
REACT_APP_BACKEND_URL=https://tudominio.com
EOF

# Compilar para producción
yarn build
```

### 4. Configurar PM2 para el Backend

Crear archivo `ecosystem.config.js`:

```bash
cd /var/www/arandu-clinic
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'arandu-backend',
    cwd: '/var/www/arandu-clinic/backend',
    script: '/var/www/arandu-clinic/backend/venv/bin/uvicorn',
    args: 'server:app --host 0.0.0.0 --port 8001',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF
```

Iniciar el backend:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Ejecutar el comando que te muestre
```

### 5. Configurar Nginx

Crear configuración de Nginx:

```bash
sudo nano /etc/nginx/sites-available/arandu-clinic
```

Agregar:

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Frontend (React build)
    location / {
        root /var/www/arandu-clinic/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/arandu-clinic /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar configuración
sudo systemctl reload nginx
```

### 6. Configurar SSL con Let's Encrypt (Opcional pero Recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

## Comandos Útiles

### Ver logs del backend:
```bash
pm2 logs arandu-backend
```

### Reiniciar el backend:
```bash
pm2 restart arandu-backend
```

### Ver estado de servicios:
```bash
pm2 status
sudo systemctl status mongod
sudo systemctl status nginx
```

### Actualizar la aplicación:
```bash
# Backend
cd /var/www/arandu-clinic/backend
source venv/bin/activate
git pull  # o sube nuevos archivos
pip install -r requirements.txt
pm2 restart arandu-backend

# Frontend
cd /var/www/arandu-clinic/frontend
git pull  # o sube nuevos archivos
yarn install
yarn build
sudo systemctl reload nginx
```

## Estructura de Archivos Esperada

```
/var/www/arandu-clinic/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── .env
│   └── venv/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── .env
│   └── build/  (generado por yarn build)
└── ecosystem.config.js
```

## Solución de Problemas

### Backend no inicia:
```bash
cd /var/www/arandu-clinic/backend
source venv/bin/activate
python server.py  # Ver errores directamente
```

### MongoDB no conecta:
```bash
sudo systemctl status mongod
mongo  # o mongosh
```

### Nginx no sirve archivos:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

## Notas Importantes

1. **Firewall**: Asegúrate de abrir los puertos 80 (HTTP) y 443 (HTTPS):
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

2. **MongoDB Seguridad**: Configura autenticación en MongoDB para producción:
   ```bash
   mongosh
   use admin
   db.createUser({user: "admin", pwd: "password", roles: ["root"]})
   ```
   Luego actualiza MONGO_URL en .env

3. **Backups**: Configura backups regulares de MongoDB:
   ```bash
   mongodump --out /backups/$(date +%Y%m%d)
   ```

## Diferencias con LAMP

| LAMP | Arandu Clinic Stack |
|------|---------------------|
| Apache | Nginx |
| MySQL | MongoDB |
| PHP | Python (FastAPI) |
| - | Node.js (React) |

---

¿Necesitas ayuda con el deployment? Contacta al equipo de desarrollo.
