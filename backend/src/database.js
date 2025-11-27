const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

console.log('📁 Base de datos en:', DB_PATH);

const db = new Database(DB_PATH);

// Configurar para OneDrive (evita archivos -wal que causan conflictos)
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = FULL');

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    cantidad INTEGER NOT NULL,
    categoria TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('✅ Base de datos inicializada');

module.exports = db;