const db = require('../db');
const { permitirCORS } = require('./_lib');
const { tokenBaja, esTokenValido, LONGITUD_TOKEN_BAJA } = require('../tokens');

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  const recibido = (req.query && req.query.token) || '';

  if (!esTokenValido(recibido, LONGITUD_TOKEN_BAJA)) {
    return res.redirect(302, '/gracias.html?estado=baja-invalida');
  }

  const token = String(recibido).trim();

  if (!token) {
    return res.redirect(302, '/gracias.html?estado=baja-invalida');
  }

  try {
    const activos = await db.listarSuscriptores();
    const el = activos.find((s) => tokenBaja(s.email) === token);

    if (!el) {
      return res.redirect(302, '/gracias.html?estado=baja-invalida');
    }

    await db.cambiarEstadoSuscriptor(el.email, 'baja', { dadoDeBajaEn: new Date() });
    return res.redirect(302, '/gracias.html?estado=baja-ok');
  } catch (err) {
    console.error('[baja]', err.message);
    return res.redirect(302, '/gracias.html?estado=error');
  }
};
