const db = require('../db');
const { CATALOGO, claveComparable } = require('../especialidades-base');
const {
  errorApi,
  tokenAleatorio,
  correoValido,
  enviarConfirmacion,
  MAX_SUSCRIPTORES,
} = require('./_lib');

function leerCuerpo(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return errorApi(res, 405, 'Use POST');
  }

  const cuerpo = leerCuerpo(req);
  const correo = db.normalizarEmail(cuerpo.email);
  const elegidas = Array.isArray(cuerpo.especialidades)
    ? cuerpo.especialidades.map((e) => String(e).trim()).filter(Boolean).slice(0, 20)
    : [];

  if (!correoValido(correo)) {
    return errorApi(res, 400, 'Ese correo no parece valido. Revisalo e intenta de nuevo.');
  }

  if (elegidas.length === 0) {
    return errorApi(res, 400, 'Elegi al menos una especialidad.');
  }

  try {
    const guardadas = (await db.listarEspecialidades()).map((e) => e.nombre);
    const validas = new Set([...guardadas, ...CATALOGO].map(claveComparable));
    const desconocidas = elegidas.filter((e) => !validas.has(claveComparable(e)));

    if (desconocidas.length > 0) {
      return errorApi(res, 400, `Esa especialidad no existe: ${desconocidas.join(', ')}`);
    }

    const existentes = await db.contarSuscriptores('activo');
    const yaExiste = await db.buscarSuscriptorPorEmail(correo);

    if (!yaExiste && existentes >= MAX_SUSCRIPTORES) {
      return errorApi(res, 503, 'Por ahora no se aceptan mas suscripciones. Intenta mas tarde.');
    }

    if (yaExiste && yaExiste.estado === 'activo') {
      const actuales = [...(yaExiste.especialidades || [])].sort();
      const pedidas = [...elegidas].sort();
      const iguales = actuales.length === pedidas.length && actuales.every((e, i) => e === pedidas[i]);

      if (iguales) {
        return res.status(200).json({
          ok: true,
          yaSuscrito: true,
          mensaje:
            'Ya estas suscrito con esas mismas especialidades. No hace falta hacer nada mas.',
        });
      }
    }

    const token = tokenAleatorio();
    await db.crearSuscriptor({ correo, especialidades: elegidas, tokenConfirmacion: token });

    try {
      await enviarConfirmacion({ correo, tokenConfirmacion: token, especialidades: elegidas });
    } catch (err) {
      console.error('[suscribir] no se pudo enviar el correo:', err.message);
      await db.cambiarEstadoSuscriptor(correo, 'error-correo', { pausadoMotivo: err.message.slice(0, 200) });
      return errorApi(res, 502, 'No se pudo enviar el correo de confirmacion. Intenta mas tarde.');
    }

    res.status(200).json({
      ok: true,
      mensaje: `Te enviamos un correo a ${correo}. Abrelo y presiona "Confirmar suscripcion".`,
    });
  } catch (err) {
    console.error('[suscribir]', err.message);
    return errorApi(res, 500, 'Hubo un problema en el servidor. Intenta mas tarde.');
  }
};
