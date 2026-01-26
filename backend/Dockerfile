# Backend - Express.js con PostgreSQL
FROM node:20-alpine

WORKDIR /app

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src/ ./src/

# Crear directorio para uploads
RUN mkdir -p /app/uploads

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "src/server.js"]
