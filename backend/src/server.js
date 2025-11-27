const express = require('express');
const cors = require('cors');
const net = require('net');
const db = require('./database');
const { PUERTOS } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

// === RUTAS API ===

app.get('/api/productos', (req, res) => {
  try {
    const productos = db.prepare('SELECT * FROM productos ORDER BY createdAt DESC').all();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/productos/:id', (req, res) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/productos', (req, res) => {
  try {
    const { nombre, precio, cantidad, categoria } = req.body;
    const stmt = db.prepare('INSERT INTO productos (nombre, precio, cantidad, categoria) VALUES (?, ?, ?, ?)');
    const result = stmt.run(nombre, precio, cantidad, categoria);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/productos/:id', (req, res) => {
  try {
    const { nombre, precio, cantidad, categoria } = req.body;
    const stmt = db.prepare('UPDATE productos SET nombre = ?, precio = ?, cantidad = ?, categoria = ? WHERE id = ?');
    const result = stmt.run(nombre, precio, cantidad, categoria, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ id: parseInt(req.params.id), ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/productos/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM productos WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check con identificador de app
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'tu-app-nombre',  // IMPORTANTE: Cambiar por el nombre único de tu app
    timestamp: new Date().toISOString() 
  });
});

// === DETECCIÓN AUTOMÁTICA DE PUERTO ===

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findAvailablePort() {
  for (const port of PUERTOS) {
    const available = await checkPort(port);
    if (available) {
      return port;
    }
    console.log(`⚠️ Puerto ${port} ocupado, intentando siguiente...`);
  }
  throw new Error('No hay puertos disponibles');
}

async function startServer() {
  try {
    const port = await findAvailablePort();
    app.listen(port, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${port}`);
      // Comunicar puerto al proceso padre (Electron)
      if (process.send) {
        process.send({ type: 'port', port });
      }
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();