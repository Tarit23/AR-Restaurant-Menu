// Simple local dev server for AR Menu Platform
// Run: node server.js
// Then open: http://localhost:3000

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.md':   'text/markdown',
  '.toml': 'text/plain',
  '.sql':  'text/plain',
  '.ts':   'text/plain',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Clean URL rewrites (match vercel.json)
  const rewrites = {
    '/':              '/home.html',
    '/home':          '/home.html',
    '/login':         '/login.html',
    '/menu':          '/menu.html',
    '/ar':            '/ar.html',
    '/admin':         '/admin/index.html',
    '/admin/restaurants': '/admin/restaurants.html',
    '/admin/menu':    '/admin/menu.html',
    '/admin/qr':      '/admin/qr.html',
    '/admin/payments':'/admin/payments.html',
    '/restaurant':    '/restaurant/index.html',
    '/restaurant/menu':        '/restaurant/menu.html',
    '/restaurant/subscription':'/restaurant/subscription.html',
    '/restaurant/qr': '/restaurant/qr.html',
  };

  if (rewrites[urlPath]) urlPath = rewrites[urlPath];

  // Serve file
  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try with .html appended
      fs.readFile(filePath + '.html', (err2, data2) => {
        if (err2) {
          // 404
          fs.readFile(path.join(ROOT, '404.html'), (e, d) => {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(d || '404 Not Found');
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }

    const contentType = MIME[ext] || 'application/octet-stream';
    
    // Add CORS headers for AR/model-viewer compatibility
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Opener-Policy': urlPath.startsWith('/ar') ? 'same-origin' : 'unsafe-none',
      'Cross-Origin-Embedder-Policy': urlPath.startsWith('/ar') ? 'require-corp' : 'unsafe-none',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', `
╔══════════════════════════════════╗
║   AR Menu Platform — Dev Server  ║
╚══════════════════════════════════╝
`);
  console.log(`  \x1b[32m✓\x1b[0m Server running at: \x1b[4mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  \x1b[32m✓\x1b[0m Landing page:      \x1b[4mhttp://localhost:${PORT}/home\x1b[0m`);
  console.log(`  \x1b[32m✓\x1b[0m Login:             \x1b[4mhttp://localhost:${PORT}/login\x1b[0m`);
  console.log(`  \x1b[32m✓\x1b[0m Admin dashboard:   \x1b[4mhttp://localhost:${PORT}/admin\x1b[0m`);
  console.log(`  \x1b[32m✓\x1b[0m Restaurant panel:  \x1b[4mhttp://localhost:${PORT}/restaurant\x1b[0m`);
  console.log('');
  console.log(`  \x1b[33m⚠\x1b[0m  Make sure to fill in js/supabase-config.js first!`);
  console.log('');
  console.log('  Press Ctrl+C to stop.\n');
});
