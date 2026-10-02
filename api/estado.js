const db = require('../db');

const HORAS_SIN_REVISAR = Number(process.env.HORAS_SIN_REVISAR || 30);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const [ultima, activos, vacantes, especialidades] = await Promise.all([
      db.obtenerUltimaEjecucion(),
      db.contarSuscriptores('activo'),
      db.contarVacantes(),
      db.contarSuscriptores(),
    ]);

    const haceCuanto = ultima ? (Date.now() - new Date(ultima.inicio).getTime()) / 3600000 : null;
    const salud =
      haceCuanto === null
        ? 'nunca'
        : haceCuanto > HORAS_SIN_REVISAR
          ? 'roja'
          : haceCuanto > HORAS_SIN_REVISAR / 2
            ? 'amarilla'
            : 'verde';

    res.status(200).json({
      ok: true,
      ultimaRevision: ultima
        ? {
            inicio: ultima.inicio,
            estado: ultima.estado,
            regiones: ultima.regiones,
            leidas: ultima.leidas,
            nuevas: ultima.nuevas,
            incompletas: ultima.incompletas,
            detalle: ultima.detalle || '',
          }
        : null,
      haceCuantoHoras: haceCuanto === null ? null : Math.round(haceCuanto * 10) / 10,
      salud,
      suscriptoresActivos: activos,
      suscriptoresTotales: especialidades,
      vacantesRegistradas: vacantes,
    });
  } catch (err) {
    console.error('[estado]', err.message);
    res.status(200).json({
      ok: false,
      salud: 'roja',
      error: 'No se pudo consultar la base de datos',
    });
  }
};
