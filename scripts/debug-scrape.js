require('dotenv').config();
const puppeteer = require('puppeteer');

const REGIONAL_SELECT = '#regionalSelect';
const TABLA = 'table.mud-table-root';

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

  console.log('regiones', regiones.length);

  let totalFilas = 0;
  for (const region of regiones.slice(0, 2)) {
    await page.select(REGIONAL_SELECT, region.value);
    await page.waitForFunction(
      (selector) => {
        const tbody = document.querySelector(`${selector} tbody`);
        if (!tbody) return false;
        const text = tbody.innerText || '';
        if (/Cargando/i.test(text)) return false;
        if (/Seleccione una Dirección Regional para buscar/i.test(text)) return false;
        const hasData = [...tbody.querySelectorAll('tr')].some((tr) => tr.querySelectorAll('td').length >= 4);
        if (hasData) return true;
        return /no se encontr|sin vacante|no hay vacante|no registra/i.test(text);
      },
      { timeout: 120000 },
      TABLA,
    );

    const filas = await page.evaluate((selector) => {
      return [...document.querySelectorAll(`${selector} tbody tr`)]
        .filter((tr) => tr.querySelectorAll('td').length >= 4)
        .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()));
    }, TABLA);

    totalFilas += filas.length;
    console.log(region.label, 'filas', filas.length, filas[0]?.[3]);
  }

  console.log('totalFilas sample', totalFilas);
  await browser.close();
})();
