const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.APP_SECRET = 'secreto-de-prueba';
process.env.ADMIN_PASSWORD = 'clave-de-prueba';
process.env.MONGO_BD = 'prueba_seguridad';
process.env.EMAIL_SIMULAR = '1';

const RAIZ = path.join(__dirname, '..');

let db;

before(async () => {
  db = require('../db.js');
  await db.obtenerBase();
});

after(async () => {
  if (!db) return;
  const base = await db.obtenerBase();
  await base.collection('suscriptores').deleteMany({});
  await base.collection('control').deleteMany({});
  await db.cerrar();
});

test('un token con forma de objeto no puede activar cuentas ajenas', async () => {
  const base = await db.obtenerBase();
  const col = base.collection('suscriptores');

  await col.deleteMany({});
  await col.insertOne({
    email: 'victima@ejemplo.com',
    estado: 'pendiente',
    tokenConfirmacion: 'a'.repeat(48),
    especialidades: ['Música'],
  });

  const inyecciones = [
    { $ne: null },
    { $ne: '' },
    { $gt: '' },
    { $regex: '.*' },
    ['a'.repeat(48)],
    null,
    undefined,
    '',
    'no-es-un-token',
    'x'.repeat(500),
  ];

  for (const ataque of inyecciones) {
    const resultado = await db.confirmarSuscriptor(ataque);
    assert.strictEqual(resultado, null, `la inyeccion ${JSON.stringify(ataque)} devolvio algo`);
  }

  const victima = await col.findOne({ email: 'victima@ejemplo.com' });
  assert.strictEqual(victima.estado, 'pendiente', 'la victima no debe cambiar de estado');
  await col.deleteMany({});
});

test('un token de confirmacion valido si activa la cuenta', async () => {
  const base = await db.obtenerBase();
  const col = base.collection('suscriptores');

  const token = 'b'.repeat(48);
  await col.insertOne({
    email: 'real@ejemplo.com',
    estado: 'pendiente',
    tokenConfirmacion: token,
    especialidades: ['Música'],
  });

  const activado = await db.confirmarSuscriptor(token);
  assert.ok(activado, 'el token bueno debe funcionar');
  assert.strictEqual(activado.estado, 'activo');
  await col.deleteMany({});
});

test('no se puede pedir confirmacion una y otra vez para el mismo correo', async () => {
  const correo = 'bombardeo@ejemplo.com';

  const primera = await db.registrarIntentoEnvio(correo);
  assert.strictEqual(primera.permitido, true, 'el primer envio debe permitirse');

  const segunda = await db.registrarIntentoEnvio(correo);
  assert.strictEqual(segunda.permitido, false, 'el segundo envio debe frenarse');
  assert.strictEqual(segunda.motivo, 'frecuencia');
});

test('hay un tope de envios por hora', async () => {
  const base = await db.obtenerBase();
  await base.collection('control').deleteMany({});

  let permitidos = 0;
  const tope = db.MAX_ENVIOS_POR_HORA + 5;

  for (let i = 0; i < tope; i += 1) {
    const r = await db.registrarIntentoEnvio(`alguien${i}@ejemplo.com`);
    if (r.permitido) permitidos += 1;
  }

  assert.ok(
    permitidos <= db.MAX_ENVIOS_POR_HORA,
    `se permitieron ${permitidos} y el tope es ${db.MAX_ENVIOS_POR_HORA}`,
  );

  await base.collection('suscriptores').deleteMany({});
  await base.collection('control').deleteMany({});
});

test('los secretos se ocultan antes de escribir en el registro', () => {
  const { ocultarSecretos } = require('../seguridad.js');

  const entradas = [
    'mongodb+srv://notificador:MIPASS123@cluster.abc.mongodb.net/?appName=x',
    'EMAIL_PASS=abcd efgh ijkl mnop',
    'appPassword: hunter2hunter2hunter2',
    'ADMIN_PASSWORD=claveMuySecreta2026',
    'API_KEY=sk-proj-abc123',
    'token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
  ];

  const marcas =
    /MIPASS123|abcd|efgh|hunter2hunter2|claveMuySecreta2026|sk-proj-abc|ghp_ABCDEFGHIJ/;

  for (const original of entradas) {
    const limpio = ocultarSecretos(original);
    assert.ok(!marcas.test(limpio), `sobrevivio algo en: ${limpio}`);
  }
});

test('los mensajes de error utiles no se rompen', () => {
  const { ocultarSecretos } = require('../seguridad.js');

  const utiles = [
    'No se pudo conectar a MongoDB Atlas: bad auth : authentication failed',
    '18 regiones leidas, 45 vacantes',
    'El token de confirmacion no coincide',
    'La clave del panel no es correcta',
  ];

  for (const original of utiles) {
    assert.strictEqual(ocultarSecretos(original), original);
  }
});