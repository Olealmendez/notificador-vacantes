require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CARPETAS = ['', 'api', 'public', 'scripts', '.github/workflows'];
const EXTENSIONES = new Set(['.js', '.json', '.yml', '.yaml', '.html', '.css', '.bat']);

// Archivos donde los "secretos" son ejemplos a proposito.
const EXCLUIDOS = [
  /\.example$/,
  /^\.env$/,
  /^vistos\.json/,
  /^ruta\.txt/,
  /^prompt-open-code\.md$/,
  /^README\.md$/,
  /^tests\//,
  /^package-lock\.json$/,
  /^scripts\/auditar\.js$/,
];

const PATRONES = [
  { nombre: 'connection string con clave', re: /mongodb\+srv:\/\/[^:@\s]+:[^@\s]+@/g },
  { nombre: 'contrasena de aplicacion de Google', re: /\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b/g },
  { nombre: 'llave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { nombre: 'token de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { nombre: 'clave de AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { nombre: 'asignacion de secreto', re: /\b[A-Z][A-Z0-9_]*(?:PASS|SECRET|TOKEN|APIKEY)[A-Z0-9_]*\s*[:=]\s*["'][^"']{8,}["']/g },
];

function revisar() {
  const problemas = [];
  let revisados = 0;

  for (const carpeta of CARPETAS) {
    const dir = path.join(RAIZ, carpeta);
    if (!fs.existsSync(dir)) continue;

    for (const f of fs.readdirSync(dir)) {
      const relativo = carpeta ? `${carpeta}/${f}` : f;
      if (EXCLUIDOS.some((r) => r.test(relativo))) continue;
      if (!EXTENSIONES.has(path.extname(f))) continue;

      const texto = fs.readFileSync(path.join(dir, f), 'utf8');
      revisados += 1;

      for (const { nombre, re } of PATRONES) {
        re.lastIndex = 0;
        const encontrados = texto.match(re);
        if (!encontrados) continue;
        problemas.push({ archivo: relativo, nombre, muestra: encontrados[0].slice(0, 50) });
      }
    }
  }

  return { problemas, revisados };
}

function revisarGitignore() {
  const faltantes = [];
  const texto = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
  const reglas = texto.split('\n').map((l) => l.trim().replace(/\/$/, ''));

  for (const necesaria of ['.env', 'vistos.json', 'ruta.txt', 'node_modules']) {
    if (!reglas.includes(necesaria)) faltantes.push(necesaria);
  }
  return faltantes;
}

const { problemas, revisados } = revisar();
const sinIgnorar = revisarGitignore();

console.log(`Revisados ${revisados} archivos publicables.\n`);

if (problemas.length > 0) {
  console.log('POSIBLES SECRETOS:');
  for (const p of problemas) {
    console.log(`  ${p.archivo}`);
    console.log(`      ${p.nombre}: ${p.muestra}`);
  }
  console.log('');
} else {
  console.log('Ningun secreto encontrado en lo que se publica.\n');
}

if (sinIgnorar.length > 0) {
  console.log(`Falta en .gitignore: ${sinIgnorar.join(', ')}\n`);
} else {
  console.log('.gitignore cubre .env, vistos.json, ruta.txt y node_modules.\n');
}

const mal = problemas.length + sinIgnorar.length;
console.log(mal === 0 ? 'Todo correcto.' : `${mal} cosa(s) por revisar.`);
process.exitCode = mal === 0 ? 0 : 1;