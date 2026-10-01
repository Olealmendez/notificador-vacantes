require('dotenv').config({ quiet: true });

const http = require('http');

const PUERTO = Number(process.env.MOCK_PORT || 4599);

// Nombres reales de las 27 direcciones regionales del MEP.
const REGIONES_MEP = [
  'Regional Educación Alajuela',
  'Regional Educación Cañas',
  'Regional Educación Cartago',
  'Regional Educación Central Del Pacífico',
  'Regional Educación Coto',
  'Regional Educación Desamparados',
  'Regional Educación Grande De Terraba',
  'Regional Educación Guapiles',
  'Regional Educación Guayabo',
  'Regional Educación Heredia',
  'Regional Educación Liberia',
  'Regional Educación Limon',
  'Regional Educación Los Santos',
  'Regional Educación Occidente',
  'Regional Educación Osa',
  'Regional Educación Peninsular',
  'Regional Educación Pérez Zeledón',
  'Regional Educación Puntarenas',
  'Regional Educación San Carlos',
  'Regional Educación San Jose - Central',
  'Regional Educación San Jose - Oeste',
  'Regional Educación Santa Cruz',
  'Regional Educación Turrialba',
  'Regional Educación Upí',
  'Regional Educación Zona Norte-Norte',
  'Regional Educación Zona Norte-Desamparados',
  'Regional Educación Grecia',
];

const PUESTOS = [
  { clase: 'Profesor De Enseñanza Media (G. De E.)', especialidad: 'Español' },
  { clase: 'Profesor De Enseñanza Media (G. De E.)', especialidad: 'Música' },
  { clase: 'Profesor De Enseñanza Técnico Profesional', especialidad: 'Música/Música' },
  { clase: 'Cocinero', especialidad: 'Sin Especialidad T-I' },
  { clase: 'Profesor De Educación Física', especialidad: 'Educación Física' },
  { clase: 'Director De Centro Educativo', especialidad: 'Administración Escolar' },
];

const CENTROS = [
  'C.T.P. De Paquera',
  'Liceo San Rafael',
  'C.T.P. De San Mateo',
  'Escuela Central San Juan',
  'C.O.P. Heredia',
  'Instituto Alajuela',
];

function tablaComoEnElPortal(region, filas) {
  const celdas = filas
    .map(
      (f) => `<tr>
        <td>${f.vacante}</td>
        <td>Direc. Regional Educacion ${region.replace(/^Regional Educacion /i, '')}</td>
        <td>${f.clase}</td>
        <td>${f.especialidad}</td>
        <td>${f.centro}</td>
        <td>${f.lecciones}</td>
        <td>${f.rige}</td>
        <td>${f.vence}</td>
        <td><a href="#">APLICAR</a></td>
        <td>62</td>
        <td>03180</td>
      </tr>`,
    )
    .join('');

  return `<table class="mud-table-root">
    <thead><tr>
      <th>Vacante</th><th>Direc. Regional</th><th>Clase de Puesto</th><th>Especialidad</th>
      <th>Centro Educativo</th><th>Lecciones</th><th>Rige desde</th><th>Vence</th><th>Aplicar</th>
    </tr></thead>
    <tbody>${celdas}</tbody>
  </table>`;
}

function construirServidor(opciones) {
  const {
    regiones,
    filasPorRegion = 3,
    filasFijas = 0,
    vacias = new Set(),
    paginas = 1,
    delay = 250,
    retardoIndice = -1,
    retardoMs = 0,
    sinIndicadorCarga = false,
    desajustarNombre = false,
  } = opciones;

  const server = http.createServer((req, res) => {
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Mock MEP</title></head>
<body>
  <h1>Formulario de Consulta de Vacantes (MOCK)</h1>
  <select id="regionalSelect">
    <option value="">Seleccione una Direcci&oacute;n Regional</option>
    ${regiones.map((r, i) => `<option value="${i + 1}">${r}</option>`).join('')}
  </select>
  <div id="resultados"><table class="mud-table-root"><tbody>
    <tr><td colspan="9">Seleccione una Direcci&oacute;n Regional para buscar</td></tr>
  </tbody></table></div>
<script>
const REGIONES = ${JSON.stringify(regiones)};
const FILAS_POR_REGION = ${filasPorRegion};
const FILAS_FIJAS = ${filasFijas};
const VACIAS = ${JSON.stringify([...vacias])};
const PAGINAS = ${pagasSeguras(paginas)};
const DELAY = ${delay};
const RETARDO_INDICE = ${retardoIndice};
const RETARDO_MS = ${retardoMs};
const SIN_INDICADOR = ${sinIndicadorCarga};
const DESAJUSTAR = ${desajustarNombre};
const POR_PAGINA = 5;

function aleatorio(semilla) {
  let x = semilla;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const PUESTOS = ${JSON.stringify(PUESTOS)};
const CENTROS = ${JSON.stringify(CENTROS)};

function filasDe(indice) {
  if (FILAS_FIJAS > 0) {
    const out = [];
    for (let k = 0; k < FILAS_FIJAS; k++) {
      out.push({
        vacante: String(9000000 + indice * 1000 + k),
        clase: 'Profesor De Enseñanza Media (G. De E.)',
        especialidad: k % 2 === 0 ? 'Música' : 'Español',
        centro: 'Centro ' + k,
        lecciones: '10',
        rige: '29/09/2026',
        vence: '11/12/2026',
      });
    }
    return out;
  }

  const rnd = aleatorio((indice + 1) * 7919);
  const total = Math.floor(rnd() * FILAS_POR_REGION) + 1;
  const out = [];
  for (let k = 0; k < total; k++) {
    const p = PUESTOS[Math.floor(rnd() * PUESTOS.length)];
    out.push({
      vacante: String(1540000 + indice * 100 + k),
      clase: p.clase,
      especialidad: p.especialidad,
      centro: CENTROS[Math.floor(rnd() * CENTROS.length)],
      lecciones: String(Math.floor(rnd() * 40)),
      rige: '29/09/2026',
      vence: '11/12/2026',
    });
  }
  return out;
}

function htmlTabla(indiceRegion, filas, pagina, totalPaginas) {
  if (VACIAS.includes(indiceRegion)) {
    return '<table class="mud-table-root"><tbody><tr><td colspan="9">No se encontraron resultados</td></tr></tbody></table>';
  }

  const todas = filasDe(indiceRegion);
  const inicio = (pagina - 1) * POR_PAGINA;
  const visibles = todas.slice(inicio, inicio + POR_PAGINA);
  const nombre = DESAJUSTAR ? 'REGION SIN NOMBRE COINCIDENTE' : REGIONES[indiceRegion].replace(/^Regional Educacion /i, '');

  const cuerpo = visibles.map(f => \`<tr>
    <td>\${f.vacante}</td>
    <td>Direc. Regional Educacion \${nombre}</td>
    <td>\${f.clase}</td>
    <td>\${f.especialidad}</td>
    <td>\${f.centro}</td>
    <td>\${f.lecciones}</td>
    <td>\${f.rige}</td>
    <td>\${f.vence}</td>
    <td><a href="#">APLICAR</a></td>
    <td>62</td>
    <td>03180</td></tr>\`).join('');

  const paginacion = totalPaginas > 1 ? \`<div class="mud-table-pagination"><div class="mud-pagination">
    <button class="mud-button-root mud-button mud-icon-button" \${pagina === 1 ? 'disabled' : ''} data-ir="1">|&lt;</button>
    <button class="mud-button-root mud-button mud-icon-button" \${pagina === 1 ? 'disabled' : ''} data-ir="\${pagina - 1}">&lt;</button>
    \${Array.from({ length: totalPaginas }, (_, i) => \`<button class="mud-button-root mud-button mud-icon-button \${i + 1 === pagina ? 'mud-button-text-primary' : ''}" data-ir="\${i + 1}">\${i + 1}</button>\`).join('')}
    <button class="mud-button-root mud-button mud-icon-button" \${pagina >= totalPaginas ? 'disabled' : ''} data-ir="\${pagina + 1}">&gt;</button>
  </div></div>\` : '';

  return \`<table class="mud-table-root"><tbody>\${cuerpo}</tbody></table>\${paginacion}\`;
}

let paginaActual = 1;
let regionActual = -1;

function pintar(indiceRegion, pagina) {
  const destino = document.getElementById('resultados');
  const total = PAGINAS;
  destino.innerHTML = htmlTabla(indiceRegion, null, pagina, total);
  regionActual = indiceRegion;
  paginaActual = pagina;
  destino.querySelectorAll('.mud-pagination button').forEach(b => {
    b.addEventListener('click', () => {
      const destino2 = Number(b.getAttribute('data-ir'));
      if (!destino2 || destino2 < 1) return;
      if (regionActual < 0) return;
      destino.innerHTML = '<table class="mud-table-root"><tbody><tr><td colspan="9">Cargando...</td></tr></tbody></table>';
      setTimeout(() => pintar(regionActual, destino2), DELAY);
    });
  });
}

document.getElementById('regionalSelect').addEventListener('change', function () {
  const v = this.value;
  if (!v) return;
  const idx = Number(v) - 1;
  const espera = idx === RETARDO_INDICE ? RETARDO_MS : DELAY;
  if (!SIN_INDICADOR) {
    document.getElementById('resultados').innerHTML = '<table class="mud-table-root"><tbody><tr><td colspan="9">Cargando...</td></tr></tbody></table>';
  }
  setTimeout(() => pintar(idx, 1), espera);
});
</script>
</body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  return server;
}

function pagasSeguras(n) {
  return Math.max(1, Math.min(Number(n) || 1, 10));
}

function arrancar(opciones) {
  return new Promise((resolve) => {
    const server = construirServidor(opciones);
    server.listen(PUERTO, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${PUERTO}/` });
    });
  });
}

module.exports = { arrancar, REGIONES_MEP, PUERTO };

if (require.main === module) {
  const n = Number(process.argv[2] || 27);
  const sub = process.argv[3] || '';
  const opts = { regiones: REGIONES_MEP.slice(0, n) };
  if (sub === 'vacias') opts.vacias = new Set([1, 2, 3]);
  if (sub === 'paginas') opts.paginas = 3;
  if (sub === 'desajuste') opts.desajustarNombre = true;

  arrancar(opts).then(({ url }) => {
    console.log(`Mock MEP en ${url} con ${opts.regiones.length} regiones (${sub || 'normal'})`);
    console.log('Ctrl+C para detener.');
  });
}
