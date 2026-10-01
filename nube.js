require('dotenv').config({ quiet: true });

const { buscarVacantesDetallado } = require('./scraper');
const { enviarAPersona } = require('./mailer');
const db = require('./db');

const EMAIL_TO = process.env.EMAIL_TO || '';
const ESPECIALIDAD_BUSCADA = process.env.ESPECIALIDAD_BUSCADA || 'Música';
const MAX_CORRIDAS_HORAS = Number(process.env.MAX_CORRIDAS_HORAS || 26);

function paso(numero, mensaje) {
  const hora = new Date().toLocaleTimeString('es-CR', { timeZone: 'America/Costa_Rica' });
  console.log(`[${hora}] PASO ${numero} — ${mensaje}`);
}

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function coincide(texto, patron) {
  return normalizar(texto).includes(normalizar(patron));
}

function leerDestinatariosEnv() {
  return EMAIL_TO.split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((email) => ({ email, especialidades: [ESPECIALIDAD_BUSCADA] }));
}

async function obtenerDestinatarios() {
  const suscriptores = await db.obtenerSuscriptoresActivos();

  if (suscriptores.length > 0) {
    return suscriptores.map((s) => ({
      email: s.email,
      especialidades: Array.isArray(s.especialidades) && s.especialidades.length > 0
        ? s.especialidades
        : [ESPECIALIDAD_BUSCADA],
    }));
  }

  return leerDestinatariosEnv();
}

async function main() {
  const inicio = new Date();

  paso(1, 'Leyendo el historial de MongoDB Atlas...');
  const idsVistos = await db.obtenerIdsVistos();
  console.log(`  -> ${idsVistos.size} vacante(s) en el historial.`);

  paso(2, 'Consultando el portal del MEP...');
  const { todasLasVacantes, especialidades, regiones, incompletas, sinVerificar } =
    await buscarVacantesDetallado();

  console.log(`  -> ${regiones.length} región(es) leída(s).`);
  console.log(`  -> ${todasLasVacantes.length} vacante(s) en total.`);
  console.log(`  -> ${especialidades.length} especialidad(es) distinta(s).`);

  if (incompletas.length > 0) {
    console.warn(`  !!!! ${incompletas.length} regiones SIN REVISAR. La corrida no es concluyente.`);
  }
  if (sinVerificar.length > 0) {
    console.warn(`  !!!! ${sinVerificar.length} regiones sin confirmar.`);
  }

  paso(3, 'Guardando especialidades y vacantes nuevas...');
  const nuevasEspecialidades = await db.registrarEspecialidades(especialidades);
  console.log(`  -> ${nuevasEspecialidades} especialidad(es) nueva(s) en el catálogo.`);

  const nuevas = todasLasVacantes.filter((v) => !idsVistos.has(v.id));
  const guardadas = await db.guardarVacantesNuevas(nuevas);
  console.log(`  -> ${nuevas.length} vacante(s) nueva(s), ${guardadas} guardada(s) en la base.`);

  if (guardadas !== nuevas.length) {
    throw new Error(
      `Discrepancia: ${nuevas.length} nuevas pero ${guardadas} guardadas. No se envía correo para no perder avisos.`,
    );
  }

  paso(4, 'Enviando avisos...');
  const destinatarios = await obtenerDestinatarios();

  if (destinatarios.length === 0) {
    console.log('  -> No hay destinatarios configurados. No se envia correo.');
  }

  let enviados = 0;

  for (const destinatario of destinatarios) {
    const suyas = nuevas.filter((v) =>
      destinatario.especialidades.some((e) => coincide(v.especialidad, e)),
    );

    if (suyas.length === 0) continue;

    try {
      await enviarAPersona(destinatario.email, suyas, {
        etiqueta: destinatario.especialidades.join(' / '),
      });
      enviados += 1;
    } catch (err) {
      console.error(`  -> FALLO al avisar a ${destinatario.email}: ${err.message}`);
      throw err;
    }
  }

  if (enviados === 0 && nuevas.length > 0) {
    console.log('  -> Ningún destinatario coincide con las especialidades pedidas.');
  }

  if (enviados > 0) {
    await db.marcarNotificadas(nuevas.map((v) => v.id));
  }

  await db.registrarEjecucion({
    inicio,
    estado: incompletas.length === 0 ? 'ok' : 'incompleta',
    origen: 'nube',
    regiones: regiones.length,
    incompletas: incompletas.length,
    sinVerificar: sinVerificar.length,
    leidas: todasLasVacantes.length,
    nuevas: nuevas.length,
    destinatarios: enviados,
    detalle: incompletas.map((i) => `${i.region}: ${i.motivo}`).join(' | ').slice(0, 500),
  });

  console.log('');
  console.log(`Listo. ${nuevas.length} vacante(s) nueva(s), ${enviados} aviso(s) enviado(s).`);
}

main()
  .then(() => db.cerrar())
  .then(() => {
    process.exitCode = 0;
  })
  .catch(async (err) => {
    console.error('');
    console.error(`[ERROR FATAL] ${err.name || 'Error'} — ${err.message}`);
    console.error((err.stack || '').split('\n').slice(1, 4).join('\n'));

    try {
      await db.registrarEjecucion({
        inicio: new Date(),
        estado: 'error',
        origen: 'nube',
        detalle: err.message.slice(0, 500),
      });
      console.error('[nube] El fallo quedó registrado en la base.');
    } catch (e) {
      console.error(`[nube] No se pudo registrar el fallo: ${e.message}`);
    }

    await db.cerrar();
    process.exitCode = 1;
  });
