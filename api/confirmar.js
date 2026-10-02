const db = require('../db');
const { permitirCORS } = require('./_lib');
const { urlBaja, esTokenValido, LONGITUD_TOKEN_CONFIRMAR } = require('../tokens');
const { registrar } = require('../seguridad');
const { enviarResumen } = require('../mailer');

const consola = { log: console.log, warn: console.warn, error: console.error };
console.log = registrar(consola, 'log');
console.warn = registrar(consola, 'warn');
console.error = registrar(consola, 'error');

async function mandarResumen(suscriptor, req) {
  try {
    const abiertas = await db.obtenerVacantesAbiertas(suscriptor.especialidades || []);

    if (abiertas.length === 0) return 0;

    await enviarResumen({
      para: suscriptor.email,
      vacantes: abiertas,
      etiqueta: (suscriptor.especialidades || []).join(' / '),
      urlBaja: urlBaja(suscriptor.email, req),
    });

    await db.cambiarEstadoSuscriptor(suscriptor.email, suscriptor.estado, {
      resumenEnviadoEn: new Date(),
      resumenVacantes: abiertas.length,
    });

    return abiertas.length;
  } catch (err) {
    console.warn(`[confirmar] no se pudo mandar el resumen a ${suscriptor.email}: ${err.message}`);
    return 0;
  }
}

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  const recibido = (req.query && req.query.token) || '';

  if (!esTokenValido(recibido, LONGITUD_TOKEN_CONFIRMAR)) {
    return res.redirect(302, '/gracias.html?estado=invalido');
  }

  const token = String(recibido).trim();

  try {
    const suscriptor = await db.confirmarSuscriptor(token);

    if (!suscriptor) {
      return res.redirect(302, '/gracias.html?estado=invalido');
    }

    await mandarResumen(suscriptor, req);

    const destino = `/gracias.html?estado=ok&correo=${encodeURIComponent(suscriptor.email)}`;
    res.setHeader(
      'Set-Cookie',
      `baja=${encodeURIComponent(urlBaja(suscriptor.email, req))}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    return res.redirect(302, destino);
  } catch (err) {
    console.error('[confirmar]', err.message);
    return res.redirect(302, '/gracias.html?estado=error');
  }
};

module.exports.mandarResumen = mandarResumen;