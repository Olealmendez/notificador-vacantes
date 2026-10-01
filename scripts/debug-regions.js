require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForSelector('#regionalSelect', { timeout: 60000 });
  const immediate = await page.$$eval('#regionalSelect option', (o) => o.length);
  await page.waitForFunction(() => document.querySelectorAll('#regionalSelect option').length > 1, {
    timeout: 60000,
  });
  const after = await page.$$eval('#regionalSelect option', (o) => o.length);
  console.log({ immediate, after });
  await browser.close();
})();
