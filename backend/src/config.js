// Configuración centralizada para Docker
const path = require("path");
const fs = require("fs");

// Cargar .env en desarrollo
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.join(__dirname, "../../.env") });
}

// Puerto del servidor
const PORT = parseInt(process.env.PORT) || 3000;

// URL de la base de datos PostgreSQL
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://admin:admin123@localhost:5432/equivalencias";

// JWT
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Usuario admin por defecto
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD; // No default password for security
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "adminitrador";
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || "admin";

// Ruta de uploads
function obtenerRutaUploads() {
  const uploadsPath =
    process.env.UPLOADS_PATH || path.join(__dirname, "../uploads");

  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  return uploadsPath;
}

module.exports = {
  PORT,
  DATABASE_URL,
  UPLOADS_PATH: obtenerRutaUploads(),
  JWT_SECRET,
  JWT_EXPIRES_IN,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_ROLE,
};
