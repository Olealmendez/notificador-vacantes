require('dotenv').config({ quiet: true });

const { MongoClient } = require('mongodb');
const { CATALOGO, sinDuplicar, juntar, filtrarPorEspecialidades } = require('./especialidades-base');
const { esTokenValido, LONGITUD_TOKEN_CONFIRMAR } = require('./tokens');

function fechaVence(texto) {
  const m = String(texto ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const NOMBRE_BD = process.env.MONGO_BD || 'notificador';

let cliente = null;

function obtenerUri() {
  if (!MONGO_URI) {
    throw new Error(
      'Falta MONGODB_URI. Configurala en el archivo .env o como secreto en GitHub.',
    );
  }
  return MONGO_URI;
}

function describirErrorConexion(err) {
  const base = `No se pudo conectar a MongoDB Atlas: ${err.message}`;

  if (/Authentication failed|auth/i.test(err.message)) {
    return (
      `${base}\n` +
      'La contrasena no es la correcta. Si cambiaste la contrasena del usuario en Atlas, ' +
      'hay que actualizarla en los dos sitios: el secreto MONGODB_URI de GitHub y el .env de esta maquina.'
    );
  }

  if (/timed out|Server selection|ENOTFOUND|SrvRecord|getaddrinfo|IP .* not allowed/i.test(err.message)) {
    return (
      `${base}\n` +
      'Problema de red. En Atlas > Network Access tiene que estar permitida la entrada 0.0.0.0/0, ' +
      'porque GitHub cambia de direccion IP en cada corrida y no publica las suyas.'
    );
  }

  return base;
}

const DIAS_LOG = Number(process.env.DIAS_LOG || 90);
const MINUTOS_ENTRE_ENVIO = Number(process.env.MINUTOS_ENTRE_ENVIO || 10);
const MAX_ENVIOS_POR_HORA = Number(process.env.MAX_ENVIOS_POR_HORA || 30);

function horaDeVentana() {
  return new Date().toISOString().slice(0, 13);
}

async function obtenerBase() {
  if (!cliente) {
    const nuevo = new MongoClient(obtenerUri(), { serverSelectionTimeoutMS: 20000 });

    try {
      await nuevo.connect();
    } catch (err) {
      await nuevo.close().catch(() => {});
      throw new Error(describirErrorConexion(err));
    }

    cliente = nuevo;
  }

  const base = cliente.db(NOMBRE_BD);
  const control = base.collection('control');
  const idxEjec = base.collection('ejecuciones');

  try {
    await idxEjec.dropIndex('inicio_-1');
  } catch {
    void 0;
  }

  await Promise.all([
    base.collection('vacantes').createIndex({ id: 1 }, { unique: true }),
    idxEjec.createIndex(
      { inicio: 1 },
      { expireAfterSeconds: DIAS_LOG * 86400 },
    ),
    base.collection('especialidades').createIndex({ nombre: 1 }, { unique: true }),
    base.collection('suscriptores').createIndex({ email: 1 }, { unique: true }),
    control.createIndex({ creadoEn: 1 }, { expireAfterSeconds: 172800 }),
  ]);

  return base;
}

async function medirUso() {
  try {
    const base = await obtenerBase();
    const stats = await base.command({ dbStats: 1 });
    const bytes = stats.storageSize + stats.indexSize;

    return {
      usadoBytes: bytes,
      limiteBytes: 512 * 1024 * 1024,
      porcentaje: Math.round((bytes / (512 * 1024 * 1024)) * 100000) / 1000,
      documentos: stats.objects,
    };
  } catch (err) {
    console.error('[db] no se pudo medir el uso:', err.message);
    return null;
  }
}

async function cerrar() {
  if (cliente) {
    await cliente.close().catch(() => {});
    cliente = null;
  }
}

async function registrarEjecucion(datos) {
  const base = await obtenerBase();
  const registro = {
    inicio: datos.inicio || new Date(),
    fin: new Date(),
    estado: datos.estado,
    origen: datos.origen || 'nube',
    regiones: datos.regiones || 0,
    incompletas: datos.incompletas || 0,
    sinVerificar: datos.sinVerificar || 0,
    leidas: datos.leidas || 0,
    nuevas: datos.nuevas || 0,
    destinatarios: datos.destinatarios || 0,
    detalle: datos.detalle || '',
  };

  await base.collection('ejecuciones').insertOne(registro);
  return registro;
}

async function obtenerUltimaEjecucion() {
  const base = await obtenerBase();
  return base.collection('ejecuciones').findOne({}, { sort: { inicio: -1 } });
}

async function registrarEspecialidades(nombres) {
  const base = await obtenerBase();
  const coleccion = base.collection('especialidades');

  const finales = juntar(nombres || [], CATALOGO);

  const ops = finales.map((nombre) => ({
    updateOne: {
      filter: { nombre },
      update: { $setOnInsert: { nombre, creadaEn: new Date(), activa: true } },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await coleccion.bulkWrite(ops, { ordered: false });
  }

  const guardadas = await coleccion.find({}, { projection: { nombre: 1 } }).toArray();
  const sobrantes = guardadas
    .map((d) => d.nombre)
    .filter((nombre) => !finales.includes(nombre));

  if (sobrantes.length > 0) {
    await coleccion.deleteMany({ nombre: { $in: sobrantes } });
  }

  return { total: finales.length, agregadas: ops.length, borradas: sobrantes.length };
}

async function sembrarCatalogo() {
  return registrarEspecialidades([]);
}

async function obtenerIdsVistos() {
  const base = await obtenerBase();
  const documentos = await base
    .collection('vacantes')
    .find({}, { projection: { id: 1, _id: 0 } })
    .toArray();
  return new Set(documentos.map((d) => d.id).filter(Boolean));
}

async function guardarVacantesNuevas(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return 0;

  const base = await obtenerBase();
  const ops = lista.map((v) => ({
    updateOne: {
      filter: { id: v.id },
      update: {
        $setOnInsert: {
          ...v,
          vistaEn: new Date(),
          notificada: false,
        },
      },
      upsert: true,
    },
  }));

  const resultado = await base.collection('vacantes').bulkWrite(ops, { ordered: false });
  return resultado.upsertedCount;
}

async function marcarNotificadas(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const base = await obtenerBase();
  const resultado = await base
    .collection('vacantes')
    .updateMany({ id: { $in: ids } }, { $set: { notificada: true, notificadaEn: new Date() } });
  return resultado.modifiedCount;
}

async function obtenerSuscriptoresActivos() {
  const base = await obtenerBase();
  return base.collection('suscriptores').find({ estado: 'activo' }).toArray();
}

async function contarVacantes() {
  const base = await obtenerBase();
  return base.collection('vacantes').countDocuments();
}

function normalizarEmail(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

async function listarEspecialidades() {
  const base = await obtenerBase();
  return base
    .collection('especialidades')
    .find({}, { projection: { nombre: 1, activa: 1 } })
    .sort({ nombre: 1 })
    .toArray();
}

async function contarSuscriptores(estado) {
  const base = await obtenerBase();
  return base.collection('suscriptores').countDocuments(estado ? { estado } : {});
}

// Vacantes que siguen abiertas y que le interesan a estas especialidades.
// Se usa para avisarle a quien se acaba de suscribir de lo que ya hay
// publicado, y no solo de lo que aparezca en el futuro.
async function obtenerVacantesAbiertas(especialidades) {
  const base = await obtenerBase();
  const hoy = new Date();
  const todas = await base.collection('vacantes').find({}).toArray();

  return todas.filter((v) => {
    const f = fechaVence(v.vence);
    return f && f >= hoy && filtrarPorEspecialidades([v], especialidades).length > 0;
  });
}

async function buscarSuscriptorPorEmail(correo) {
  const base = await obtenerBase();
  return base.collection('suscriptores').findOne({ email: normalizarEmail(correo) });
}

async function crearSuscriptor({ correo, especialidades, tokenConfirmacion }) {
  const base = await obtenerBase();
  const email = normalizarEmail(correo);
  const ahora = new Date();

  await base.collection('suscriptores').updateOne(
    { email },
    {
      $set: {
        email,
        especialidades,
        estado: 'pendiente',
        tokenConfirmacion,
        solicitadoEn: ahora,
        confirmadoEn: null,
        dadoDeBajaEn: null,
        pausadoMotivo: null,
      },
    },
    { upsert: true },
  );

  return buscarSuscriptorPorEmail(email);
}

async function confirmarSuscriptor(token) {
  if (!esTokenValido(token, LONGITUD_TOKEN_CONFIRMAR)) return null;

  const base = await obtenerBase();
  const doc = await base
    .collection('suscriptores')
    .findOne({ tokenConfirmacion: String(token).trim() });

  if (!doc) return null;

  await base.collection('suscriptores').updateOne(
    { _id: doc._id },
    {
      $set: { estado: 'activo', confirmadoEn: new Date() },
      $unset: { tokenConfirmacion: '' },
    },
  );

  return buscarSuscriptorPorEmail(doc.email);
}

async function cambiarEstadoSuscriptor(email, estado, extra = {}) {
  const base = await obtenerBase();
  const cambios = { estado, ...extra };
  await base.collection('suscriptores').updateOne({ email: normalizarEmail(email) }, { $set: cambios });
  return buscarSuscriptorPorEmail(email);
}

async function actualizarEspecialidadesDeSuscriptor(email, especialidades) {
  const base = await obtenerBase();
  await base
    .collection('suscriptores')
    .updateOne({ email: normalizarEmail(email) }, { $set: { especialidades } });
  return buscarSuscriptorPorEmail(email);
}

async function listarSuscriptores() {
  const base = await obtenerBase();
  return base
    .collection('suscriptores')
    .find({}, { projection: { tokenConfirmacion: 0 } })
    .sort({ email: 1 })
    .toArray();
}

function puedeEnviarConfirmacion(email) {
  return { MINUTOS_ENTRE_ENVIO, MAX_ENVIOS_POR_HORA, horaDeVentana };
}

async function registrarIntentoEnvio(email) {
  const base = await obtenerBase();
  const control = base.collection('control');
  const correo = normalizarEmail(email);
  const ahora = new Date();
  const ventana = horaDeVentana();
  const clave = `envio:${correo}`;

  const uso = await control.findOneAndUpdate(
    { _id: `ventana:${ventana}` },
    { $inc: { n: 1 }, $setOnInsert: { creadoEn: ahora } },
    { upsert: true, returnDocument: 'after' },
  );

  const enviadosEstaHora = uso && uso.n ? uso.n : 1;
  if (enviadosEstaHora > MAX_ENVIOS_POR_HORA) {
    return { permitido: false, motivo: 'tope-horario' };
  }

  // El ultimo envio se guarda aparte del suscriptor para que el limite
  // funcione aunque ese documento todavia no exista.
  const anterior = await control.findOneAndUpdate(
    { _id: clave },
    { $set: { ultimoEnvio: ahora }, $setOnInsert: { creadoEn: ahora } },
    { upsert: true, returnDocument: 'before' },
  );

  const ultimo = anterior && anterior.ultimoEnvio ? new Date(anterior.ultimoEnvio).getTime() : 0;

  if (ultimo && ahora.getTime() - ultimo < MINUTOS_ENTRE_ENVIO * 60000) {
    return { permitido: false, motivo: 'frecuencia' };
  }

  return { permitido: true, motivo: 'ok' };
}

module.exports = {
  obtenerBase,
  cerrar,
  medirUso,
  registrarIntentoEnvio,
  MINUTOS_ENTRE_ENVIO,
  MAX_ENVIOS_POR_HORA,
  DIAS_LOG,
  registrarEjecucion,
  obtenerUltimaEjecucion,
  registrarEspecialidades,
  sembrarCatalogo,
  listarEspecialidades,
  obtenerIdsVistos,
  guardarVacantesNuevas,
  marcarNotificadas,
  obtenerSuscriptoresActivos,
  contarVacantes,
  contarSuscriptores,
  obtenerVacantesAbiertas,
  fechaVence,
  normalizarEmail,
  buscarSuscriptorPorEmail,
  crearSuscriptor,
  confirmarSuscriptor,
  cambiarEstadoSuscriptor,
  actualizarEspecialidadesDeSuscriptor,
  listarSuscriptores,
  NOMBRE_BD,
};
