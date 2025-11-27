const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

console.log('📁 Base de datos en:', DB_PATH);

const db = new Database(DB_PATH);

// Configurar para OneDrive (evita archivos -wal que causan conflictos)
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = FULL');

// Crear tablas
db.exec(`
  -- Tabla Principal de Partes Navitrans
  CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL UNIQUE,         -- NAV81N6-26601
      description TEXT NOT NULL,                 -- CADENA (SIN ZAPATAS)
      response_brand TEXT DEFAULT 'Navitrans',   -- Marca Respuesta
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabla de Compatibilidades
  CREATE TABLE IF NOT EXISTS part_compatibilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      compatible_part_number TEXT NOT NULL,      -- 860340638, 20Y-30-00023, etc.
      equipment_model TEXT NOT NULL,             -- XE225ULC, PC200-6, etc.
      original_brand TEXT NOT NULL,              -- XCMG, KOMATSU, DOOSAN, etc.
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
  );

  -- Tabla de Imágenes (para cuando quieras agregar fotos)
  CREATE TABLE IF NOT EXISTS part_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
  );

  -- ÍNDICES para búsqueda rápida
  CREATE INDEX IF NOT EXISTS idx_parts_number ON parts(part_number);
  CREATE INDEX IF NOT EXISTS idx_compat_number ON part_compatibilities(compatible_part_number);

  -- ============================================
  -- VISTA: Para búsqueda unificada
  -- ============================================
  DROP VIEW IF EXISTS v_parts_search;
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
  LEFT JOIN part_compatibilities pc ON p.id = pc.part_id;
`);

console.log('✅ Base de datos inicializada');

module.exports = db;