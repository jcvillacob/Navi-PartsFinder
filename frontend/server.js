const express = require('express');
const path = require('path');

const app = express();
const PORT = 4000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - todas las rutas van a index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Frontend corriendo en http://localhost:${PORT}`);
});
