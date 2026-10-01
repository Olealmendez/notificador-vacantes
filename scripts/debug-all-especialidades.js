require('dotenv').config();
const puppeteer = require('puppeteer');
const REGIONAL_SELECT = '#regionalSelect';
const TABLA = 'table.mud-table-root';

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function palabrasClaveRegion(label) {
  return normalizarTexto(label)
    .split(/\s+/)
    .filter((p) => p.length > 3 && p !== 'regional' && p !== 'educacion' && p !== 'direccion');
}

async function esperarRegion(page, regionLabel) {
  const claves = palabrasClaveRegion(regionLabel);
  await page
    .waitForFunction(
      (selector) => {
        const tbody = document.querySelector(`${selector} tbody`);
        return Boolean(tbody && /Cargando/i.test(tbody.innerText));
      },
      { timeout: 15000 },
      TABLA,
    )
    .catch(() => {});

  await page.waitForFunction(
    (selector, keys) => {
      const tbody = document.querySelector(`${selector} tbody`);
      if (!tbody) return false;
      const text = tbody.innerText || '';
      if (/Cargando/i.test(text)) return false;
      if (/Seleccione una Dirección Regional para buscar/i.test(text)) return false;
      const filas = [...tbody.querySelectorAll('tr')].filter((tr) => tr.querySelectorAll('td').length >= 4);
      if (filas.length > 0) {
        const regionNorm = normalizarTexto(filas[0].querySelectorAll('td')[1]?.innerText || '');
        return keys.some((k) => regionNorm.includes(k));
      }
      return /no se encontr|sin vacante|no hay vacante|no registra/i.test(text);
    },
    { timeout: 120000 },
    TABLA,
    claves,
  );
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForSelector(REGIONAL_SELECT, { timeout: 60000 });

  const regiones = await page.$$eval(`${REGIONAL_SELECT} option`, (options) =>
    options
      .map((opt) => ({ value: opt.value, label: opt.textContent.trim() }))
      .filter((opt) => opt.value && !/seleccione/i.test(opt.label)),
  );

  const especialidades = new Set();
  for (const region of regiones) {
    await page.select(REGIONAL_SELECT, region.value);
    await esperarRegion(page, region.label);

    const filas = await page.evaluate((selector) => {
      return [...document.querySelectorAll(`${selector} tbody tr`)]
        .filter((tr) => tr.querySelectorAll('td').length >= 4)
        .map((tr) => tr.querySelectorAll('td')[3]?.innerText?.trim())
        .filter(Boolean);
    }, TABLA);

    filas.forEach((e) => especialidades.add(e));
  }

  const musica = [...especialidades].filter((e) => /musi/i.test(e));
  console.log('total especialidades', especialidades.size);
  console.log('musica', musica);
  await browser.close();
})();
