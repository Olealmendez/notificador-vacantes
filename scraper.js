require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const puppeteer = require('puppeteer');

const TARGET_URL = process.env.TARGET_URL;
const ESPECIALIDAD_BUSCADA = process.env.ESPECIALIDAD_BUSCADA || 'Música';

const REGIONAL_SELECT = '#regionalSelect';
const TABLA_RESULTADOS = 'table.mud-table-root';

const TIEMPO_MAX_REGION_MS = Number(process.env.TIEMPO_MAX_REGION_MS || 60000);
const ESPERA_ESTABLE_MS = Number(process.env.ESPERA_ESTABLE_MS || 8000);
const ESPERA_VACIA_MS = Number(process.env.ESPERA_VACIA_MS || 1200);
const INTENTOS_POR_REGION = Number(process.env.INTENTOS_POR_REGION || 3);
const MAX_PAGINAS = Number(process.env.MAX_PAGINAS || 100);
const REGIONES_MAXIMO_ESPERADO = Number(process.env.REGIONES_MAXIMO_ESPERADO || 27);

const PALABRAS_GENERICAS = new Set([
  'regional',
  'regionales',
  'educacion',
  'direccion',
  'dregional',
  'dre',
  'el',
  'de',
  'la',
  'las',
  'los',
  'del',
  'y',
]);

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function coincideEspecialidad(especialidad) {
  const buscada = normalizarTexto(ESPECIALIDAD_BUSCADA);
  if (!buscada) return true;
  return normalizarTexto(especialidad).includes(buscada);
}

function crearIdVacante({ region, centroEducativo, especialidad, vacante }) {
  const base = [region, centroEducativo, especialidad, vacante].join('|');
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
}

const ARGUMENTOS_CHROME = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

async function lanzarNavegador() {
  const base = { headless: true, args: ARGUMENTOS_CHROME };

  const intentos = [];
  if (process.env.PUPPETEER_EXECUTABLE) {
    intentos.push({ ...base, executablePath: process.env.PUPPETEER_EXECUTABLE });
  }
  intentos.push(base, { ...base, channel: 'chrome' });

  const fallos = [];

  for (const opciones of intentos) {
    try {
      return await puppeteer.launch(opciones);
    } catch (err) {
      fallos.push(`${opciones.executablePath || opciones.channel || 'chromium de puppeteer'}: ${err.message.split('\n')[0]}`);
    }
  }

  throw new Error(`No se pudo abrir el navegador. Intentos:\n  - ${fallos.join('\n  - ')}`);
}

function palabrasClaveRegion(label) {
  const palabras = normalizarTexto(label)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const utiles = palabras.filter((p) => !PALABRAS_GENERICAS.has(p));

  if (utiles.length > 0) return utiles;

  const respaldo = palabras.filter((p) => p.length >= 3);
  return respaldo.length > 0 ? respaldo : palabras;
}

async function inspeccionarTabla(page) {
  return page.evaluate((selector) => {
    const normalizar = (t) =>
      String(t ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();

    const tabla = document.querySelector(selector);
    const tbody = tabla ? tabla.querySelector('tbody') : null;
    const texto = (tbody ? tbody.innerText : '') || '';

    const filas = tbody
      ? [...tbody.querySelectorAll('tr')].filter((tr) => tr.querySelectorAll('td').length >= 4)
      : [];
    const datos = filas.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()));

    const paginacion = document.querySelector('.mud-table-pagination');
    const textoPaginacion = paginacion
      ? (paginacion.innerText || '').replace(/\s+/g, ' ').trim()
      : '';
    const botones = paginacion ? [...paginacion.querySelectorAll('button, .mud-button-root')] : [];

    const activa = botones.find(
      (b) =>
        b.getAttribute('aria-current') === 'page' ||
        /mud-button-text-primary|\bactive\b|selected/.test(b.className || ''),
    );

    const paginaActual = activa ? Number((activa.innerText || '').trim()) : null;
    const hayBotones = botones.length > 0;

    return {
      estado: /cargando/i.test(texto)
        ? 'cargando'
        : /seleccione una direcci[oó]n regional/i.test(texto)
          ? 'placeholder'
          : datos.length === 0
            ? 'vacia'
            : 'con_datos',
      filas: datos,
      texto: normalizar(texto),
      regionColumna: datos.length > 0 ? (datos[0][1] || '') : '',
      huella: [
        textoPaginacion,
        paginaActual === null ? '' : `p${paginaActual}`,
        ...datos.map((f) => f.join('|')),
      ].join('\n'),
      paginacion: {
        existe: hayBotones,
        paginaActual,
        paginaActualConocida: paginaActual !== null && Number.isFinite(paginaActual),
      },
    };
  }, TABLA_RESULTADOS);
}

async function esperarEstadoTabla(page, { claves, huellaPrevia, timeoutMs }) {
  const limite = Date.now() + timeoutMs;
  let estableDesde = null;
  let vaciaDesde = null;

  while (Date.now() < limite) {
    const info = await inspeccionarTabla(page);

    if (info.estado === 'cargando' || info.estado === 'placeholder') {
      estableDesde = null;
      vaciaDesde = null;
      await dormir(150);
      continue;
    }

    if (info.estado === 'vacia') {
      if (vaciaDesde === null) vaciaDesde = Date.now();
      if (Date.now() - vaciaDesde >= ESPERA_VACIA_MS) {
        return { ok: true, info, motivo: 'vacia' };
      }
      await dormir(150);
      continue;
    }

    const cambio = info.huella !== huellaPrevia;
    const nombreCoincide = claves.some((clave) => info.texto.includes(clave));

    if (cambio || nombreCoincide) {
      return { ok: true, info, motivo: cambio ? 'cambio' : 'nombre' };
    }

    if (estableDesde === null) estableDesde = Date.now();
    if (Date.now() - estableDesde >= ESPERA_ESTABLE_MS) {
      return { ok: true, info, motivo: 'estable' };
    }

    await dormir(150);
  }

  return { ok: false, info: null, motivo: 'timeout' };
}

function verificarRegion(info, claves) {
  if (info.estado !== 'con_datos') return true;

  const columna = normalizarTexto(info.regionColumna);
  if (!columna) return false;

  return claves.some((clave) => columna.includes(clave));
}

async function seleccionarRegion(page, valor) {
  await page.select(REGIONAL_SELECT, valor);
  await page.evaluate((selector) => {
    const select = document.querySelector(selector);
    if (!select) return;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, REGIONAL_SELECT);
}

function mapearFila(c) {
  return {
    vacante: c[0] ?? '',
    region: c[1] ?? '',
    clasePuesto: c[2] ?? '',
    especialidad: c[3] ?? '',
    centroEducativo: c[4] ?? '',
    lecciones: c[5] ?? '',
    rige: c[6] ?? '',
    vence: c[7] ?? '',
  };
}

async function pulsarPagina(page, objetivoNumero) {
  return page.evaluate((objetivo) => {
    const paginacion = document.querySelector('.mud-table-pagination');
    if (!paginacion) return { pulso: false, motivo: 'sin paginacion' };

    const botones = [...paginacion.querySelectorAll('button, .mud-button-root')];
    if (botones.length === 0) return { pulso: false, motivo: 'sin botones' };

    const deshabilitado = (b) =>
      b.disabled === true ||
      b.getAttribute('aria-disabled') === 'true' ||
      /mud-disabled/.test(b.className || '');
    const numero = (b) => {
      const t = (b.innerText || '').trim();
      return /^\d+$/.test(t) ? Number(t) : null;
    };
    const esPaginaActual = (b) =>
      b.getAttribute('aria-current') === 'page' ||
      /mud-button-text-primary|\bactive\b|selected/.test(b.className || '');

    if (objetivo !== null && objetivo !== undefined) {
      const destino = botones.find((b) => numero(b) === objetivo && !deshabilitado(b));
      if (destino) {
        destino.click();
        return { pulso: true, motivo: `pagina ${objetivo}` };
      }
      return { pulso: false, motivo: `no existe la pagina ${objetivo}` };
    }

    const etiquetado = [...botones]
      .reverse()
      .find(
        (b) =>
          !deshabilitado(b) &&
          /next|siguiente|avanzar/i.test(
            `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`,
          ),
      );

    if (etiquetado) {
      etiquetado.click();
      return { pulso: true, motivo: 'siguiente etiquetado' };
    }

    const habilitado = [...botones].filter((b) => !deshabilitado(b));
    for (let i = habilitado.length - 1; i >= 0; i -= 1) {
      if (!esPaginaActual(habilitado[i])) {
        habilitado[i].click();
        return { pulso: true, motivo: 'ultimo boton habilitado' };
      }
    }

    return { pulso: false, motivo: 'no queda ninguna pagina' };
  }, objetivoNumero);
}

async function irAPaginaUno(page, info) {
  if (!info.paginacion.existe) return info;
  if (!info.paginacion.paginaActualConocida || info.paginacion.paginaActual <= 1) return info;

  const huellaAntes = info.huella;
  const paso = await pulsarPagina(page, 1);
  if (!paso.pulso) return info;

  const vuelta = await esperarEstadoTabla(page, {
    claves: [],
    huellaPrevia: huellaAntes,
    timeoutMs: ESPERA_ESTABLE_MS,
  });

  return vuelta.ok ? vuelta.info : info;
}

async function recorrerPaginas(page, { claves, timeoutMs }) {
  const porFila = new Map();
  const firmasVistas = new Set();
  let info = await irAPaginaUno(page, await inspeccionarTabla(page));
  let paginas = 0;

  while (true) {
    for (const fila of info.filas) porFila.set(fila.join('|'), mapearFila(fila));
    paginas += 1;

    const firma = info.huella;
    if (firmasVistas.has(firma)) {
      console.warn('[scraper] El listado repitió una página. Se detiene para no dar vueltas.');
      break;
    }
    firmasVistas.add(firma);

    if (paginas >= MAX_PAGINAS) {
      console.warn(`[scraper] Se alcanzó el tope de ${MAX_PAGINAS} páginas. Conviene revisarla a mano.`);
      break;
    }

    const actual = info.paginacion.paginaActualConocida ? info.paginacion.paginaActual : null;
    const paso = await pulsarPagina(page, actual === null ? null : actual + 1);
    if (!paso.pulso) break;

    const avance = await esperarEstadoTabla(page, { claves, huellaPrevia: firma, timeoutMs });
    if (!avance.ok) {
      console.warn('[scraper] La tabla no se actualizó al cambiar de página. Se conserva lo leído.');
      break;
    }
    info = avance.info;
  }

  return [...porFila.values()];
}

async function extraerVacantesDeRegion(page, region) {
  const claves = palabrasClaveRegion(region.label);
  let respaldo = null;

  for (let intento = 1; intento <= INTENTOS_POR_REGION; intento += 1) {
    const ultimoIntento = intento === INTENTOS_POR_REGION;

    try {
      const previa = await inspeccionarTabla(page);
      await seleccionarRegion(page, region.value);

      const espera = await esperarEstadoTabla(page, {
        claves,
        huellaPrevia: previa.huella,
        timeoutMs: TIEMPO_MAX_REGION_MS,
      });

      if (!espera.ok) {
        throw new Error(`la tabla no se actualizó en ${TIEMPO_MAX_REGION_MS / 1000}s`);
      }

      if (!verificarRegion(espera.info, claves)) {
        respaldo = espera.info.filas;
        throw new Error('la tabla seguía mostrando datos de otra región');
      }

      const filas = await recorrerPaginas(page, {
        claves,
        timeoutMs: TIEMPO_MAX_REGION_MS,
      });

      return { ok: true, filas, verificada: true, intentos: intento };
    } catch (err) {
      if (ultimoIntento) {
        if (respaldo && respaldo.length > 0) {
          return {
            ok: true,
            filas: respaldo.map(mapearFila),
            verificada: false,
            intentos: intento,
          };
        }
        return { ok: false, filas: [], motivo: err.message, intentos: intento };
      }

      console.warn(
        `[scraper] ${region.label}: ${err.message}. Reintento ${intento + 1}/${INTENTOS_POR_REGION}...`,
      );
      await dormir(1000 * intento);
    }
  }

  return { ok: false, filas: [], motivo: 'sin intentos', intentos: 0 };
}

async function obtenerOpcionesRegionales(page) {
  const crudas = await page.$$eval(`${REGIONAL_SELECT} option`, (options) =>
    options.map((opt) => ({
      value: opt.value,
      label: (opt.textContent || '').trim(),
      disabled: opt.disabled === true,
    })),
  );

  const vistas = new Set();
  const validas = [];

  for (const opt of crudas) {
    if (!opt.value) continue;
    if (opt.disabled) continue;
    if (/seleccione|elija|escoja|opci[oó]n/i.test(opt.label)) continue;
    if (vistas.has(opt.value)) continue;
    vistas.add(opt.value);
    validas.push({ value: opt.value, label: opt.label });
  }

  return validas;
}

async function buscarVacantesDetallado() {
  if (!TARGET_URL) {
    throw new Error('TARGET_URL no está definida en el archivo .env');
  }

  const browser = await lanzarNavegador();
  const page = await browser.newPage();
  const inicio = Date.now();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector(REGIONAL_SELECT, { timeout: 60000 });
    await page.waitForFunction(
      (selector) => document.querySelectorAll(`${selector} option`).length > 1,
      { timeout: 60000 },
      REGIONAL_SELECT,
    );

    const regiones = await obtenerOpcionesRegionales(page);

    if (regiones.length === 0) {
      throw new Error(
        'El desplegable no devolvió ninguna dirección regional. ' +
          'El portal puede haber cambiado o estar caído. No se puede concluir nada.',
      );
    }

    console.log(`[scraper] ${regiones.length} direcciones regionales con vacantes.`);
    if (ESPECIALIDAD_BUSCADA) {
      console.log(`[scraper] Filtro de especialidad: "${ESPECIALIDAD_BUSCADA}"`);
    }
    if (regiones.length > REGIONES_MAXIMO_ESPERADO) {
      console.warn(
        `[scraper] Ojo: aparecen ${regiones.length} regiones, más de las ${REGIONES_MAXIMO_ESPERADO} esperadas. ` +
          'Puede que la lista haya cambiado.',
      );
    }

    const todas = [];
    const incompletas = [];
    const sinVerificar = [];

    for (const [indice, region] of regiones.entries()) {
      const etiqueta = `[${indice + 1}/${regiones.length}] ${region.label}`;

      const resultado = await extraerVacantesDeRegion(page, region);
      const musicales = resultado.filas.filter((v) => coincideEspecialidad(v.especialidad));

      for (const vacante of resultado.filas) {
        todas.push({ ...vacante, id: crearIdVacante(vacante) });
      }

      if (resultado.ok) {
        if (resultado.verificada === false) {
          sinVerificar.push({ region: region.label, filas: resultado.filas.length });
          console.warn(`[scraper] ${etiqueta} leída pero SIN CONFIRMAR que sea la región correcta.`);
        } else {
          console.log(`[scraper] ${etiqueta} -> ${resultado.filas.length} fila(s), ${musicales.length} de música.`);
        }
      } else {
        incompletas.push({ region: region.label, motivo: resultado.motivo });
        console.warn(`[scraper] ${etiqueta} SIN REVISAR (${resultado.motivo}).`);
      }
    }

    const unicasPorId = [...new Map(todas.map((v) => [v.id, v])).values()];

    const especialidades = [
      ...new Set(
        unicasPorId
          .map((v) => String(v.especialidad || '').trim())
          .filter((e) => e.length > 0 && !/sin especialidad/i.test(e)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));

    const unicas = unicasPorId.filter((v) => coincideEspecialidad(v.especialidad));

    console.log(`[scraper] ${unicasPorId.length} vacante(s) leída(s) en total.`);
    console.log(`[scraper] ${unicas.length} de música. ${especialidades.length} especialidad(es) distintas.`);
    if (incompletas.length > 0) {
      console.warn(
        `[scraper] ${incompletas.length} de ${regiones.length} regiones quedaron sin revisar. ` +
          'El resultado de esta corrida está incompleto.',
      );
    }
    if (sinVerificar.length > 0) {
      console.warn(
        `[scraper] ${sinVerificar.length} regiones se leyeron sin poder confirmar que fueran las correctas.`,
      );
    }

    return {
      vacantes: unicas,
      todasLasVacantes: unicasPorId,
      especialidades,
      regiones,
      incompletas,
      sinVerificar,
      duracionMs: Date.now() - inicio,
    };
  } finally {
    await browser.close();
  }
}

async function buscarVacantes() {
  const { vacantes } = await buscarVacantesDetallado();
  return vacantes;
}

module.exports = {
  buscarVacantes,
  buscarVacantesDetallado,
};
