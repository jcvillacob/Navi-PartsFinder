// Configuración centralizada para Docker
const path = require("path");

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
const INVENTORY_SYNC_TOKEN =
  process.env.INVENTORY_SYNC_TOKEN || "navi-local-sync-token";

// Orígenes permitidos para CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "http://localhost:3100")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Usuario admin por defecto
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD; // No default password for security
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "adminitrador";
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || "admin";

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "undefined") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

// Configuración S3 (MinIO/local S3 compatible)
const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://minio:9000";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";
const S3_BUCKET = process.env.S3_BUCKET || "parts-images";
const S3_FORCE_PATH_STYLE = parseBoolean(process.env.S3_FORCE_PATH_STYLE, true);

module.exports = {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  INVENTORY_SYNC_TOKEN,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_ROLE,
  ALLOWED_ORIGINS,
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_BUCKET,
  S3_FORCE_PATH_STYLE,
};
