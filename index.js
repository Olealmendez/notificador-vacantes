require('dotenv').config({ quiet: true });

const { buscarVacantesDetallado } = require('./scraper');
const { obtenerVacantesVistas, guardarVacantesVistas } = require('./storage');
const { enviarAlerta } = require('./mailer');

function paso(numero, mensaje) {
  const hora = new Date().toLocaleTimeString('es-CR');
  console.log(`\n[${hora}] PASO ${numero} — ${mensaje}`);
}

function aviso(mensaje) {
  console.warn(`\n  !!!!  ${mensaje}`);
}

async function main() {
  const inicio = Date.now();
  const duracion = () => `${((Date.now() - inicio) / 1000).toFixed(1)}s`;

  paso(1, 'Consultando el portal del MEP...');
  const { vacantes, regiones, incompletas, sinVerificar } = await buscarVacantesDetallado();
  console.log(`  -> ${regiones.length} región(es) con vacantes en el portal.`);
  console.log(`  -> ${vacantes.length} vacante(s) de música.`);

  const nadaClaro = incompletas.length > 0 || sinVerificar.length > 0;

  if (incompletas.length > 0) {
    aviso(`ATENCIÓN: ${incompletas.length} de ${regiones.length} regiones NO se pudieron revisar.`);
    for (const item of incompletas) {
      console.warn(`    - ${item.region} (${item.motivo})`);
    }
  }

  if (sinVerificar.length > 0) {
    aviso(`${sinVerificar.length} regiones se leyeron sin poder confirmar que fueran las correctas.`);
    for (const item of sinVerificar) {
      console.warn(`    - ${item.region} (${item.filas} fila(s))`);
    }
  }

  if (nadaClaro) {
    aviso('Esta corrida NO es concluyente. Lo que faltó se avisará en la próxima.');
  }

  paso(2, 'Leyendo el historial local (vistos.json)...');
  const historial = await obtenerVacantesVistas();
  const idsVistos = new Set(historial.map((v) => v.id).filter(Boolean));
  console.log(`  -> ${historial.length} vacante(s) registradas previamente.`);

  paso(3, 'Comparando contra el historial...');
  const nuevas = vacantes.filter((v) => !idsVistos.has(v.id));
  const yaNotificadas = vacantes.length - nuevas.length;
  console.log(`  -> ${nuevas.length} nueva(s) | ${yaNotificadas} ya notificada(s).`);

  for (const v of nuevas) {
    console.log(`     * ${v.centroEducativo} — ${v.especialidad} (${v.lecciones} leccion(es), vence ${v.vence})`);
  }

  if (nuevas.length === 0) {
    if (nadaClaro) {
      aviso('No se detectaron vacantes nuevas, pero el resultado NO es concluyente.');
    } else {
      console.log('\nNo hay vacantes nuevas. No se envia correo.');
    }
    console.log(`\nProceso finalizado en ${duracion()}.`);
    return;
  }

  paso(4, 'Enviando alerta por correo...');
  try {
    await enviarAlerta(nuevas);
  } catch (err) {
    console.error(`  -> FALLO al enviar el correo: ${err.message}`);
    console.error('  -> El historial NO se actualizara, para reintentar en la proxima corrida.');
    process.exitCode = 1;
    return;
  }
  console.log('  -> Correo entregado.');

  paso(5, 'Actualizando el historial...');
  await guardarVacantesVistas([...historial, ...nuevas]);
  console.log(`  -> El historial ahora tiene ${historial.length + nuevas.length} registro(s).`);

  console.log(`\nProceso finalizado en ${duracion()}.`);
}

main().catch((err) => {
  console.error('\n[ERROR FATAL]', err.name || 'Error', '-', err.message);
  process.exitCode = 1;
});
