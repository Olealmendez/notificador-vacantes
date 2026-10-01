const fs = require('fs/promises');
const path = require('path');

const VISTOS_PATH = path.join(__dirname, 'vistos.json');

async function obtenerVacantesVistas() {
  let raw;

  try {
    raw = await fs.readFile(VISTOS_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  if (!raw.trim()) {
    console.warn('[storage] vistos.json está vacío. Se empieza de cero.');
    return [];
  }

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn('[storage] vistos.json no tiene el formato esperado. Se empieza de cero.');
      return [];
    }
    return data;
  } catch (err) {
    const respaldo = `${VISTOS_PATH}.danado-${Date.now()}`;
    await fs.rename(VISTOS_PATH, respaldo).catch(() => {});
    console.warn(`[storage] vistos.json estaba dañado (${err.message}).`);
    console.warn(`[storage] Se guardó una copia en ${path.basename(respaldo)} y se empieza de cero.`);
    console.warn('[storage] Vas a recibir avisos de todo lo que haya ahora. Es normal y solo pasa una vez.');
    return [];
  }
}

async function guardarVacantesVistas(data) {
  if (!Array.isArray(data)) {
    throw new TypeError('guardarVacantesVistas espera un array');
  }

  const contenido = JSON.stringify(data, null, 2);
  const temporal = `${VISTOS_PATH}.${process.pid}.tmp`;

  await fs.writeFile(temporal, contenido, 'utf8');
  try {
    await fs.rename(temporal, VISTOS_PATH);
  } catch (err) {
    await fs.unlink(temporal).catch(() => {});
    throw err;
  }
}

module.exports = {
  obtenerVacantesVistas,
  guardarVacantesVistas,
};
