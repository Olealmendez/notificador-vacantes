const crypto = require('crypto');

const APP_SECRET = process.env.APP_SECRET || '';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

function normalizar(texto) {
  return String(texto ?? '').trim().toLowerCase();
}

function tokenBaja(correo) {
  if (!APP_SECRET) {
    throw new Error('Falta APP_SECRET. Hay que definirlo igual en Vercel y en los secretos de GitHub.');
  }
  return crypto.createHmac('sha256', APP_SECRET).update(normalizar(correo)).digest('hex').slice(0, 32);
}

function urlBaja(correo) {
  if (!APP_URL) return '';
  return `${APP_URL}/api/baja?token=${encodeURIComponent(tokenBaja(correo))}`;
}

module.exports = {
  tokenBaja,
  urlBaja,
  APP_SECRET,
  APP_URL,
};
