# Frontend - Angular
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de producción
RUN npm run build -- --configuration production

# Etapa 2: Servidor estático
FROM node:20-alpine

WORKDIR /app

# Copiar archivos compilados
COPY --from=builder /app/dist/mi-app-frontend/browser ./dist

# Copiar servidor
COPY server.js ./

# Instalar solo express
RUN npm init -y && npm install express@4

EXPOSE 4000

CMD ["node", "server.js"]
