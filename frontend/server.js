const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const API_UPSTREAM = process.env.API_UPSTREAM || 'http://backend:5000';
const upstreamUrl = new URL(API_UPSTREAM);

function proxyApiRequest(req, res) {
  const targetPath = req.originalUrl.replace(/^\/api/, '');
  const requestPath = `/api${targetPath}`;
  const client = upstreamUrl.protocol === 'https:' ? https : http;

  const proxyRequest = client.request(
    {
      protocol: upstreamUrl.protocol,
      hostname: upstreamUrl.hostname,
      port:
        upstreamUrl.port ||
        (upstreamUrl.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: requestPath,
      headers: {
        ...req.headers,
        host: upstreamUrl.host,
      },
    },
    (proxyResponse) => {
      res.status(proxyResponse.statusCode || 502);
      Object.entries(proxyResponse.headers).forEach(([key, value]) => {
        if (typeof value !== 'undefined') {
          res.setHeader(key, value);
        }
      });
      proxyResponse.pipe(res);
    }
  );

  proxyRequest.on('error', (error) => {
    console.error('Error haciendo proxy a backend:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Backend no disponible' });
    }
  });

  req.pipe(proxyRequest);
}

app.use('/api', proxyApiRequest);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - todas las rutas van a index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Frontend corriendo en http://localhost:${PORT}`);
});
