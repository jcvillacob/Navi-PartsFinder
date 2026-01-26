const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const {
  DATABASE_URL,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_ROLE,
} = require("./config");

console.log("📁 Conectando a PostgreSQL...");

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Función para inicializar la base de datos
async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`
      -- Tabla de usuarios
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'importer', 'viewer')),
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla Principal de Partes Navitrans
      CREATE TABLE IF NOT EXISTS parts (
          id SERIAL PRIMARY KEY,
          part_number TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          response_brand TEXT DEFAULT 'Navitrans',
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de Compatibilidades
      CREATE TABLE IF NOT EXISTS part_compatibilities (
          id SERIAL PRIMARY KEY,
          part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          response_brand TEXT DEFAULT 'Navitrans',
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de Compatibilidades
      CREATE TABLE IF NOT EXISTS part_compatibilities (
          id SERIAL PRIMARY KEY,
          part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          compatible_part_number TEXT NOT NULL,
          equipment_model TEXT NOT NULL,
          original_brand TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de Imágenes
      CREATE TABLE IF NOT EXISTS part_images (
          id SERIAL PRIMARY KEY,
          part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          image_path TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabla de Logs de Actividad
      CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          username TEXT,
          action_type TEXT NOT NULL CHECK (action_type IN ('LOGIN', 'SEARCH', 'UPLOAD')),
          details JSONB,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ÍNDICES para búsqueda rápida
      CREATE INDEX IF NOT EXISTS idx_parts_number ON parts(part_number);
      CREATE INDEX IF NOT EXISTS idx_compat_number ON part_compatibilities(compatible_part_number);
    `);

    // Crear usuario admin por defecto si no existe
    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE username = $1",
      [DEFAULT_ADMIN_USERNAME],
    );

    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, role, name)
         VALUES ($1, $2, $3, $4)`,
        [
          DEFAULT_ADMIN_USERNAME,
          passwordHash,
          DEFAULT_ADMIN_ROLE,
          DEFAULT_ADMIN_NAME,
        ],
      );
    }

    // Crear vista (PostgreSQL requiere DROP y CREATE por separado)
    await client.query(`DROP VIEW IF EXISTS v_parts_search`);
    await client.query(`
      CREATE VIEW v_parts_search AS
      SELECT
          p.id,
          p.part_number,
          p.description,
          pc.compatible_part_number,
          pc.equipment_model,
          pc.original_brand,
          p.response_brand,
          (SELECT pi.image_path FROM part_images pi WHERE pi.part_id = p.id LIMIT 1) AS image
      FROM parts p
      LEFT JOIN part_compatibilities pc ON p.id = pc.part_id
    `);

    console.log("✅ Base de datos PostgreSQL inicializada");
  } finally {
    client.release();
  }
}

// Helpers para mantener compatibilidad con la API anterior
const db = {
  pool,

  // Query simple
  async query(text, params) {
    return pool.query(text, params);
  },

  // Obtener un solo registro
  async get(text, params) {
    const result = await pool.query(text, params);
    return result.rows[0];
  },

  // Obtener múltiples registros
  async all(text, params) {
    const result = await pool.query(text, params);
    return result.rows;
  },

  // Ejecutar sin retorno
  async run(text, params) {
    const result = await pool.query(text, params);
    return { changes: result.rowCount, lastID: result.rows[0]?.id };
  },

  // Inicializar
  initialize: initializeDatabase,
};

module.exports = db;
