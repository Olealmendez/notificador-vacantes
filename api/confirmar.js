const db = require('../db');
const { urlBaja } = require('./_lib');

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) || '';

  if (!token) {
    return res.redirect(302, '/gracias.html?estado=invalido');
  }

  try {
    const suscriptor = await db.confirmarSuscriptor(token);

    if (!suscriptor) {
      return res.redirect(302, '/gracias.html?estado=invalido');
    }

    const destino = `/gracias.html?estado=ok&correo=${encodeURIComponent(suscriptor.email)}`;
    res.setHeader('Set-Cookie', `baja=${encodeURIComponent(urlBaja(suscriptor.email))}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return res.redirect(302, destino);
  } catch (err) {
    console.error('[confirmar]', err.message);
    return res.redirect(302, '/gracias.html?estado=error');
  }
};
