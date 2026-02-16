# Backend - Express.js con PostgreSQL
FROM node:20-alpine

WORKDIR /app

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "src/server.js"]
