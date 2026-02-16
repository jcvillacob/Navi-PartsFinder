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
          compatible_part_number TEXT NOT NULL DEFAULT '',
          equipment_model TEXT NOT NULL DEFAULT '',
          original_brand TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Migración para instalaciones con esquema anterior de compatibilidades
      ALTER TABLE part_compatibilities
        ADD COLUMN IF NOT EXISTS compatible_part_number TEXT,
        ADD COLUMN IF NOT EXISTS equipment_model TEXT,
        ADD COLUMN IF NOT EXISTS original_brand TEXT;

      UPDATE part_compatibilities
      SET
        compatible_part_number = COALESCE(compatible_part_number, ''),
        equipment_model = COALESCE(equipment_model, ''),
        original_brand = COALESCE(original_brand, '')
      WHERE
        compatible_part_number IS NULL
        OR equipment_model IS NULL
        OR original_brand IS NULL;

      ALTER TABLE part_compatibilities
        ALTER COLUMN compatible_part_number SET DEFAULT '',
        ALTER COLUMN equipment_model SET DEFAULT '',
        ALTER COLUMN original_brand SET DEFAULT '';

      ALTER TABLE part_compatibilities
        ALTER COLUMN compatible_part_number SET NOT NULL,
        ALTER COLUMN equipment_model SET NOT NULL,
        ALTER COLUMN original_brand SET NOT NULL;

      -- Tabla de Imágenes
      CREATE TABLE IF NOT EXISTS part_images (
          id SERIAL PRIMARY KEY,
          part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          image_path TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Migración de metadatos de imágenes para storage S3
      ALTER TABLE part_images
        ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 's3',
        ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS object_key_original TEXT,
        ADD COLUMN IF NOT EXISTS object_key_medium TEXT,
        ADD COLUMN IF NOT EXISTS object_key_thumb TEXT,
        ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'image/webp',
        ADD COLUMN IF NOT EXISTS size_bytes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS width INTEGER,
        ADD COLUMN IF NOT EXISTS height INTEGER,
        ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
        ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      UPDATE part_images
      SET
        storage_provider = COALESCE(NULLIF(storage_provider, ''), 's3'),
        content_type = COALESCE(NULLIF(content_type, ''), 'image/webp'),
        size_bytes = COALESCE(size_bytes, 0),
        is_primary = COALESCE(is_primary, TRUE),
        object_key_medium = COALESCE(object_key_medium, image_path),
        object_key_thumb = COALESCE(object_key_thumb, image_path)
      WHERE
        storage_provider IS NULL
        OR storage_provider = ''
        OR content_type IS NULL
        OR content_type = ''
        OR size_bytes IS NULL
        OR is_primary IS NULL
        OR object_key_medium IS NULL
        OR object_key_thumb IS NULL;

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

      -- Tabla de disponibilidad (snapshot local sincronizado)
      CREATE TABLE IF NOT EXISTS inventory_availability (
          id SERIAL PRIMARY KEY,
          part_number TEXT NOT NULL,
          zona TEXT NOT NULL DEFAULT '',
          sede TEXT NOT NULL DEFAULT '',
          almacen TEXT NOT NULL DEFAULT '',
          cantidad NUMERIC NOT NULL DEFAULT 0,
          costo_unitario NUMERIC NOT NULL DEFAULT 0,
          source_updated_at TIMESTAMP,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(part_number, zona, sede, almacen)
      );

      -- ÍNDICES para búsqueda rápida
      CREATE INDEX IF NOT EXISTS idx_parts_number ON parts(part_number);
      CREATE INDEX IF NOT EXISTS idx_compat_number ON part_compatibilities(compatible_part_number);
      CREATE INDEX IF NOT EXISTS idx_inventory_part_number ON inventory_availability(part_number);
      CREATE INDEX IF NOT EXISTS idx_part_images_primary ON part_images(part_id, is_primary, created_at DESC);
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
          p.image_url AS image
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
