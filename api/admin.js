const db = require('../db');
const { errorApi, verificarAdmin, permitirCORS } = require('./_lib');

const ESTADOS = ['activo', 'pendiente', 'pausado', 'baja', 'error-correo'];

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const permiso = verificarAdmin(req);

  if (!permiso.ok) {
    return errorApi(res, permiso.motivo === 'Falta ADMIN_PASSWORD en Vercel' ? 500 : 401, permiso.motivo);
  }

  try {
    if (req.method === 'GET') {
      const lista = await db.listarSuscriptores();
      const ultima = await db.obtenerUltimaEjecucion();

      return res.status(200).json({
        ok: true,
        suscriptores: lista.map((s) => ({
          email: s.email,
          estado: s.estado,
          especialidades: s.especialidades || [],
          solicitadoEn: s.solicitadoEn,
          confirmadoEn: s.confirmadoEn,
          dadoDeBajaEn: s.dadoDeBajaEn,
          motivo: s.pausadoMotivo || '',
        })),
        resumen: {
          total: lista.length,
          activos: lista.filter((s) => s.estado === 'activo').length,
          pendientes: lista.filter((s) => s.estado === 'pendiente').length,
        },
        ultimaRevision: ultima,
      });
    }

    if (req.method === 'POST') {
      const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const correo = db.normalizarEmail(cuerpo.email);
      const accion = String(cuerpo.accion || '');
      const destino = ESTADOS.find((e) => e === cuerpo.estado);

      if (!correo) return errorApi(res, 400, 'Falta el correo');

      if (accion === 'actualizar' && Array.isArray(cuerpo.especialidades)) {
        const nuevas = cuerpo.especialidades.slice(0, 20);
        const actualizado = await db.actualizarEspecialidadesDeSuscriptor(correo, nuevas);
        if (!actualizado) return errorApi(res, 404, 'Ese correo no esta suscrito');
        return res.status(200).json({ ok: true, suscriptor: actualizado.email });
      }

      if (accion === 'estado' && destino) {
        const cambiado = await db.cambiarEstadoSuscriptor(correo, destino, {
          pausadoMotivo: destino === 'pausado' ? 'Pausado a mano desde el panel' : null,
          dadoDeBajaEn: destino === 'baja' ? new Date() : null,
        });
        if (!cambiado) return errorApi(res, 404, 'Ese correo no esta suscrito');
        return res.status(200).json({ ok: true, suscriptor: cambiado.email, estado: destino });
      }

      return errorApi(res, 400, 'Accion no reconocida');
    }

    return errorApi(res, 405, 'Use GET o POST');
  } catch (err) {
    console.error('[admin]', err.message);
    return errorApi(res, 500, 'Hubo un problema en el servidor');
  }
};
