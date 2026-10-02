require('dotenv').config({ quiet: true });

const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = Number(process.env.PUERTO_LOCAL || 4788);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const RUTAS_API = {
  '/api/especialidades': 'especialidades',
  '/api/estado': 'estado',
  '/api/suscribir': 'suscribir',
  '/api/confirmar': 'confirmar',
  '/api/baja': 'baja',
  '/api/admin': 'admin',
};

function responder(res, codigo, cuerpo, tipo) {
  res.writeHead(codigo, { 'Content-Type': tipo || 'application/json; charset=utf-8' });
  res.end(cuerpo);
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  if (url.pathname.startsWith('/api/')) {
    const nombre = RUTAS_API[url.pathname];
    if (!nombre) return responder(res, 404, JSON.stringify({ ok: false, error: 'No existe' }));

    const archivo = path.join(RAIZ, 'api', `${nombre}.js`);
    delete require.cache[require.resolve(archivo)];

    const manejador = require(archivo);
    let cuerpo = '';

    req.on('data', (d) => (cuerpo += d));

    req.on('end', () => {
      if (cuerpo) {
        try {
          req.body = JSON.parse(cuerpo);
        } catch {
          req.body = cuerpo;
        }
      }
      req.query = Object.fromEntries(url.searchParams);

      res.json = (d) => responder(res, res.codigo || 200, JSON.stringify(d));
      res.status = (codigo) => {
        res.codigo = codigo;
        return res;
      };
      res.redirect = (codigo, destino) => {
        res.writeHead(codigo, { Location: destino });
        res.end();
      };
      if (!res.setHeader) res.setHeader = () => {};

      Promise.resolve(manejador(req, res)).catch((err) => {
        console.error(`ERROR en ${nombre}:`, err.message);
        if (!res.headersSent) responder(res, 500, JSON.stringify({ ok: false, error: err.message }));
      });
    });
    return;
  }

  const relativo = url.pathname === '/' ? '/index.html' : url.pathname;
  const destino = path.join(RAIZ, 'public', relativo);

  if (!destino.startsWith(path.join(RAIZ, 'public'))) {
    return responder(res, 403, 'Prohibido', 'text/plain; charset=utf-8');
  }

  fs.readFile(destino, (err, datos) => {
    if (err) {
      return responder(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
    }
    responder(res, 200, datos, TIPOS[path.extname(destino)] || 'application/octet-stream');
  });
});

if (require.main === module) {
  servidor.listen(PUERTO, '127.0.0.1', () => {
    console.log(`Pagina de prueba en http://127.0.0.1:${PUERTO}/`);
    console.log('Ctrl+C para detener. Esta vista no envia correos de verdad.');
  });
}

module.exports = { servidor, PUERTO };
