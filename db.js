require('dotenv').config({ quiet: true });

const { MongoClient } = require('mongodb');

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

async function obtenerBase() {
  if (!cliente) {
    const nuevo = new MongoClient(obtenerUri(), { serverSelectionTimeoutMS: 20000 });
    await nuevo.connect();
    cliente = nuevo;
  }

  const base = cliente.db(NOMBRE_BD);

  await Promise.all([
    base.collection('vacantes').createIndex({ id: 1 }, { unique: true }),
    base.collection('ejecuciones').createIndex({ inicio: -1 }),
    base.collection('especialidades').createIndex({ nombre: 1 }, { unique: true }),
    base.collection('suscriptores').createIndex({ email: 1 }, { unique: true }),
  ]);

  return base;
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
  if (!Array.isArray(nombres) || nombres.length === 0) return 0;

  const base = await obtenerBase();
  const ops = [...new Set(nombres.map((n) => String(n).trim()).filter(Boolean))].map((nombre) => ({
    updateOne: {
      filter: { nombre },
      update: { $setOnInsert: { nombre, creadaEn: new Date(), activa: true } },
      upsert: true,
    },
  }));

  const resultado = await base.collection('especialidades').bulkWrite(ops, { ordered: false });
  return resultado.upsertedCount;
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

module.exports = {
  obtenerBase,
  cerrar,
  registrarEjecucion,
  obtenerUltimaEjecucion,
  registrarEspecialidades,
  obtenerIdsVistos,
  guardarVacantesNuevas,
  marcarNotificadas,
  obtenerSuscriptoresActivos,
  contarVacantes,
  NOMBRE_BD,
};
