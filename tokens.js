const crypto = require('crypto');

const APP_SECRET = process.env.APP_SECRET || '';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

const LONGITUD_TOKEN_CONFIRMAR = 48;
const LONGITUD_TOKEN_BAJA = 32;

function normalizar(texto) {
  return String(texto ?? '').trim().toLowerCase();
}

// Los tokens que genera este programa son siempre hexadecimal. Rechazar
// cualquier otra cosa evita que alguien mande un objeto tipo {"$ne": null}
// para saltarse la confirmacion del correo.
function esTokenValido(token, longitud) {
  if (typeof token !== 'string') return false;
  const limpio = token.trim();
  if (limpio.length > 200) return false;
  return new RegExp(`^[a-f0-9]{${longitud}}$`).test(limpio);
}

function limpiarToken(token, longitud) {
  return esTokenValido(token, longitud) ? token.trim() : '';
}

function tokenBaja(correo) {
  if (!APP_SECRET) {
    throw new Error('Falta APP_SECRET. Hay que definirlo igual en Vercel y en los secretos de GitHub.');
  }
  return crypto.createHmac('sha256', APP_SECRET).update(normalizar(correo)).digest('hex').slice(0, 32);
}

function baseUrl(req) {
  if (APP_URL) return APP_URL;

  if (req && req.headers) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) return `${proto}://${String(host).split(',')[0]}`;
  }

  return '';
}

function urlBaja(correo, req) {
  const base = baseUrl(req);
  if (!base) return '';
  return `${base}/api/baja?token=${encodeURIComponent(tokenBaja(correo))}`;
}

function urlConfirmar(token, req) {
  const base = baseUrl(req);
  if (!base) return '';
  return `${base}/api/confirmar?token=${encodeURIComponent(token)}`;
}

module.exports = {
  tokenBaja,
  urlBaja,
  urlConfirmar,
  baseUrl,
  esTokenValido,
  limpiarToken,
  LONGITUD_TOKEN_CONFIRMAR,
  LONGITUD_TOKEN_BAJA,
  APP_SECRET,
  APP_URL,
};