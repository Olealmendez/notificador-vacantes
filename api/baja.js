const db = require('../db');
const { tokenBaja, permitirCORS } = require('./_lib');

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  const token = (req.query && req.query.token) || '';

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
