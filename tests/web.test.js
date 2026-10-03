const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.APP_SECRET = 'secreto-de-prueba';
process.env.ADMIN_PASSWORD = 'clave-de-prueba';
process.env.MONGO_BD = 'prueba_web';
process.env.EMAIL_SIMULAR = '1';

const RAIZ = path.join(__dirname, '..');
const PUERTO = 4799;
const BASE = `http://127.0.0.1:${PUERTO}`;
const CORREO = 'Profesor.DE.Musica@Ejemplo.COM';

let servidor;
let db;
let tokenConfirmacion;

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, { redirect: 'manual', ...opciones });
  const texto = await r.text();
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto;
  }
  return { status: r.status, cuerpo, location: r.headers.get('location') };
}

before(async () => {
  process.env.APP_URL = BASE;
  const { servidor: s } = require('../scripts/servidor-web.js');
  servidor = s;
  await new Promise((r) => servidor.listen(PUERTO, '127.0.0.1', r));
  db = require('../db.js');

  // Atlas no deja borrar la base entera con este usuario, asi que se limpia
  // documento por documento para que las pruebas no dependan de la corrida
  // anterior.
  const base = await db.obtenerBase();
  for (const col of ['suscriptores', 'control', 'ejecuciones']) {
    await base.collection(col).deleteMany({});
  }
});

after(async () => {
  if (db) {
    const base = await db.obtenerBase();
    for (const col of ['suscriptores', 'control', 'ejecuciones']) {
      await base.collection(col).deleteMany({});
    }
    await db.cerrar();
  }
  if (servidor) servidor.close();
});

test('el catalogo incluye Musica aunque no haya vacantes de musica', async () => {
  const r = await pedir('/api/especialidades');
  assert.strictEqual(r.status, 200);
  assert.ok(r.cuerpo.ok);
  assert.ok(r.cuerpo.especialidades.includes('Música'), 'faltaria Musica en el catalogo');
});

test('rechaza datos invalidos con el codigo correcto', async () => {
  const post = (cuerpo) =>
    pedir('/api/suscribir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

  assert.strictEqual((await post({ email: 'no-es-correo', especialidades: ['Música'] })).status, 400);
  assert.strictEqual((await post({ email: 'a@b.com', especialidades: [] })).status, 400);
  assert.strictEqual((await post({ email: 'a@b.com', especialidades: ['Klingon'] })).status, 400);
  assert.strictEqual((await pedir('/api/suscribir')).status, 405);
});

test('el panel exige contrasena', async () => {
  assert.strictEqual((await pedir('/api/admin')).status, 401);
  assert.strictEqual(
    (await pedir('/api/admin', { headers: { 'x-admin-password': 'mala' } })).status,
    401,
  );
  const buena = await pedir('/api/admin', { headers: { 'x-admin-password': 'clave-de-prueba' } });
  assert.strictEqual(buena.status, 200);
  assert.ok(Array.isArray(buena.cuerpo.suscriptores));
});

test('suscribir deja al usuario pendiente y con el correo normalizado', async () => {
  const r = await pedir('/api/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, email: CORREO, especialidades: ['Música'] }),
  });
  assert.strictEqual(r.status, 200);

  const base = await db.obtenerBase();
  const doc = await base.collection('suscriptores').findOne({});
  assert.strictEqual(doc.email, 'profesor.de.musica@ejemplo.com');
  assert.strictEqual(doc.estado, 'pendiente');
  assert.ok(doc.tokenConfirmacion);
  tokenConfirmacion = doc.tokenConfirmacion;
});

test('confirmar activa la cuenta y el token no se puede reusar', async () => {
  const r = await pedir(`/api/confirmar?token=${tokenConfirmacion}`);
  assert.strictEqual(r.status, 302);
  assert.match(r.location, /estado=ok/);

  const base = await db.obtenerBase();
  const doc = await base.collection('suscriptores').findOne({});
  assert.strictEqual(doc.estado, 'activo');
  assert.strictEqual(doc.tokenConfirmacion, undefined);

  const reuso = await pedir(`/api/confirmar?token=${tokenConfirmacion}`);
  assert.match(reuso.location, /invalido/);
});

test('suscribirse de nuevo con lo mismo no manda otro correo', async () => {
  const r = await pedir('/api/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO, especialidades: ['Música'] }),
  });
  assert.match(r.cuerpo.mensaje, /ya estas suscrito/i);
});

test('el resumen al suscribir solo incluye vacantes abiertas de esa especialidad', async () => {
  const base = await db.obtenerBase();
  const col = base.collection('vacantes');

  await col.deleteMany({});
  const hoy = new Date();

  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const ayer = new Date(hoy.getTime() - 86400000);
  const enUnMes = new Date(hoy.getTime() + 30 * 86400000);

  await col.insertMany([
    { id: 'a1', especialidad: 'Música/Música', centroEducativo: 'Abierta', vence: fmt(enUnMes) },
    { id: 'a2', especialidad: 'Inglés', centroEducativo: 'Otra especialidad', vence: fmt(enUnMes) },
    { id: 'a3', especialidad: 'Música', centroEducativo: 'Vencida', vence: fmt(ayer) },
  ]);

  const paraMusica = await db.obtenerVacantesAbiertas(['Música']);
  assert.strictEqual(paraMusica.length, 1, 'solo debe traer la de musica que sigue abierta');
  assert.strictEqual(paraMusica[0].centroEducativo, 'Abierta');

  const paraTodas = await db.obtenerVacantesAbiertas(['Todas']);
  assert.strictEqual(paraTodas.length, 2, '"Todas" trae las dos abiertas, no la vencida');

  const paraIngles = await db.obtenerVacantesAbiertas(['Inglés']);
  assert.strictEqual(paraIngles.length, 1);

  const paraNada = await db.obtenerVacantesAbiertas(['Klingon']);
  assert.strictEqual(paraNada.length, 0);

  const comprobacion = await db.obtenerVacantesAbiertas(['Música']);
  const vencida = comprobacion.find((v) => v.centroEducativo === 'Vencida');
  assert.ok(!vencida, 'una vacante vencida no debe salir');

  await col.deleteMany({});
});

test('el enlace de baja solo afecta a su propio correo', async () => {
  const { tokenBaja } = require('../tokens.js');
  const base = await db.obtenerBase();
  const doc = await base.collection('suscriptores').findOne({});

  const ajeno = await pedir(`/api/baja?token=${tokenBaja('victima@ejemplo.com')}`);
  assert.match(ajeno.location, /baja-invalida/);
  assert.strictEqual((await base.collection('suscriptores').findOne({})).estado, 'activo');

  const propio = await pedir(`/api/baja?token=${tokenBaja(doc.email)}`);
  assert.match(propio.location, /baja-ok/);
  assert.strictEqual((await base.collection('suscriptores').findOne({})).estado, 'baja');
});

test('los enlaces se arman con el dominio de la peticion si APP_URL no esta', async () => {
  const ruta = require.resolve('../tokens.js');
  const guardadoUrl = process.env.APP_URL;
  delete process.env.APP_URL;
  delete require.cache[ruta];
  const t = require(ruta);

  const enlace = t.urlConfirmar('abc', {
    headers: { host: 'notificador-vacantes.vercel.app', 'x-forwarded-proto': 'https' },
  });
  assert.strictEqual(enlace, 'https://notificador-vacantes.vercel.app/api/confirmar?token=abc');

  const baja = t.urlBaja('x@y.com', { headers: { host: 'otro.vercel.app', 'x-forwarded-proto': 'https' } });
  assert.ok(baja.startsWith('https://otro.vercel.app/api/baja?token='));

  if (guardadoUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = guardadoUrl;
  delete require.cache[ruta];
});

test('sin APP_SECRET avisa con un mensaje claro', () => {
  const ruta = require.resolve('../tokens.js');
  const guardado = process.env.APP_SECRET;
  delete process.env.APP_SECRET;
  delete require.cache[ruta];
  const t = require(ruta);

  assert.throws(() => t.tokenBaja('x@y.com'), /APP_SECRET/);

  process.env.APP_SECRET = guardado;
  delete require.cache[ruta];
});

test('el correo de aviso incluye el enlace de baja', async () => {
  const { construirHtml, construirTextoPlano } = require('../mailer.js');
  const { urlBaja } = require('../tokens.js');
  const enlace = urlBaja('alguien@ejemplo.com');
  const vacante = {
    region: 'Peninsular',
    centroEducativo: 'C.T.P. De Paquera',
    especialidad: 'Música/Música',
    lecciones: '2',
    vence: '11/12/2026',
    vacante: '1548052',
  };

  const html = construirHtml([vacante], 'Música', { urlBaja: enlace });
  const texto = construirTextoPlano([vacante], 'Música', { urlBaja: enlace });

  assert.ok(html.includes(enlace), 'el HTML debe traer el enlace');
  assert.ok(texto.includes(enlace), 'el texto plano debe traer el enlace');
  assert.ok(html.includes('Darte de baja'));
});
