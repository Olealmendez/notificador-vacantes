const db = require('../db');
const { permitirCORS } = require('./_lib');
const { urlBaja, esTokenValido, LONGITUD_TOKEN_CONFIRMAR } = require('../tokens');

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  const recibido = (req.query && req.query.token) || '';

  if (!esTokenValido(recibido, LONGITUD_TOKEN_CONFIRMAR)) {
    return res.redirect(302, '/gracias.html?estado=invalido');
  }

  const token = String(recibido).trim();

  if (!token) {
    return res.redirect(302, '/gracias.html?estado=invalido');
  }

  try {
    const suscriptor = await db.confirmarSuscriptor(token);

    if (!suscriptor) {
      return res.redirect(302, '/gracias.html?estado=invalido');
    }

    const destino = `/gracias.html?estado=ok&correo=${encodeURIComponent(suscriptor.email)}`;
    res.setHeader('Set-Cookie', `baja=${encodeURIComponent(urlBaja(suscriptor.email, req))}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return res.redirect(302, destino);
  } catch (err) {
    console.error('[confirmar]', err.message);
    return res.redirect(302, '/gracias.html?estado=error');
  }
};
