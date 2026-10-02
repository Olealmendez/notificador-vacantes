const db = require('../db');
const { CATALOGO } = require('../especialidades-base');
const { permitirCORS } = require('./_lib');

module.exports = async (req, res) => {
  if (permitirCORS(req, res)) return;

  try {
    await db.sembrarCatalogo();

    const guardadas = await db.listarEspecialidades();
    const activas = guardadas.filter((e) => e.activa !== false).map((e) => e.nombre);

    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).json({
      ok: true,
      especialidades: activas.length > 0 ? activas : ESPECIDADES_BASE,
      origen: 'catalogo',
    });
  } catch (err) {
    console.error('[especialidades]', err.message);
    res.status(200).json({ ok: true, especialidades: ESPECIDADES_BASE, origen: 'respaldo' });
  }
};
