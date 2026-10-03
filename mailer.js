require('dotenv').config({ quiet: true });

const nodemailer = require('nodemailer');

const EMAIL_FROM_NOMBRE = process.env.EMAIL_FROM_NOMBRE || 'Notificador de Vacantes MEP';
const ESPECIALIDAD_BUSCADA = process.env.ESPECIALIDAD_BUSCADA || 'Música';

let transporter = null;
let transporterEmailUser = null;
let simulador = null;

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validarConfiguracion(exigeDestinatario = false) {
  const faltantes = [];
  if (!process.env.EMAIL_USER) faltantes.push('EMAIL_USER');
  if (!process.env.EMAIL_PASS) faltantes.push('EMAIL_PASS');
  if (exigeDestinatario) {
    const lista = (process.env.EMAIL_TO || '').trim();
    if (!lista) faltantes.push('EMAIL_TO');
  }

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${faltantes.join(', ')}. ` +
        'Para Gmail usa una Contraseña de aplicación, no tu contraseña normal.',
    );
  }
}

function obtenerTransporter() {
  const user = process.env.EMAIL_USER;

  if (process.env.EMAIL_SIMULAR === '1') {
    if (simulador) return simulador;
    simulador = {
      async sendMail(mensaje) {
        console.log(`[correo simulado] para=${mensaje.to} asunto="${mensaje.subject}"`);
        return { simulated: true, messageId: 'simulado' };
      },
    };
    return simulador;
  }

  if (transporter && transporterEmailUser === user) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass: process.env.EMAIL_PASS,
    },
  });
  transporterEmailUser = user;

  return transporter;
}

function construirHtml(vacantes, etiqueta, opciones = {}) {
  const linea = etiqueta || ESPECIALIDAD_BUSCADA;
  const encabezado = opciones.encabezado || `Vacantes nuevas de ${linea}`;
  const titulo = opciones.titulo || 'Vacantes nuevas';
  const subtitulo =
    opciones.subtitulo ||
    `${vacantes.length} vacante(s) detectada(s) que no estaban en tu historial.`;
  const baja = opciones.urlBaja
    ? `<p style="margin:0"><a href="${escaparHtml(opciones.urlBaja)}" style="color:#5f6368">Darte de baja de estos avisos</a></p>`
    : '';
  const filas = vacantes
    .map((v) => {
      const enlace = process.env.TARGET_URL
        ? `<a href="${escaparHtml(process.env.TARGET_URL)}" style="color:#1a73e8;">Ver vacantes en el MEP</a>`
        : '';

      return `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;vertical-align:top;">${escaparHtml(v.region)}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;vertical-align:top;">${escaparHtml(v.centroEducativo)}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;vertical-align:top;">${escaparHtml(v.especialidad)}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;vertical-align:top;text-align:center;">${escaparHtml(v.lecciones)}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;vertical-align:top;text-align:center;white-space:nowrap;">${escaparHtml(v.vence)}</td>
        </tr>
        <tr>
          <td colspan="5" style="padding:0 12px 10px;border:1px solid #e0e0e0;font-size:12px;color:#555;">
            Puesto: ${escaparHtml(v.clasePuesto)} &middot; N&uacute;mero de vacante: ${escaparHtml(v.vacante)} ${enlace}
          </td>
        </tr>`;
    })
    .join('');

  const fecha = new Date().toLocaleString('es-CR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#202124;">
  <div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);">
    <div style="background:#1a73e8;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;color:#ffffff;">${escaparHtml(encabezado)}</h1>
      <p style="margin:6px 0 0;font-size:14px;color:#e8f0fe;">${escaparHtml(subtitulo)}</p>
    </div>

    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f3f4;">
            <th align="left"  style="padding:10px 12px;border:1px solid #e0e0e0;">Direcci&oacute;n Regional</th>
            <th align="left"  style="padding:10px 12px;border:1px solid #e0e0e0;">Centro Educativo</th>
            <th align="left"  style="padding:10px 12px;border:1px solid #e0e0e0;">Especialidad</th>
            <th align="center" style="padding:10px 12px;border:1px solid #e0e0e0;">Lecciones</th>
            <th align="center" style="padding:10px 12px;border:1px solid #e0e0e0;">Vence</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    <div style="padding:14px 24px;background:#f1f3f4;font-size:12px;color:#5f6368;">
      Generado autom&aacute;ticamente el ${escaparHtml(fecha)} &middot; Ministerio de Educaci&oacute;n P&uacute;blica de Costa Rica.
      ${baja}
    </div>
  </div>
</body>
</html>`;
}

function construirTextoPlano(vacantes, etiqueta, opciones = {}) {
  const linea = etiqueta || ESPECIALIDAD_BUSCADA;
  const lineas = vacantes.map(
    (v) =>
      `- ${v.region} | ${v.centroEducativo} | ${v.especialidad} | ${v.lecciones} leccion(es) | vence ${v.vence} | vacante ${v.vacante}`,
  );

  return [
    `Vacantes nuevas de ${linea} (${vacantes.length}):`,
    '',
    ...lineas,
    '',
    `Consulta: ${process.env.TARGET_URL || ''}`,
    opciones.urlBaja ? `\nDarte de baja: ${opciones.urlBaja}` : '',
  ].join('\n');
}

async function enviarAPersona(destinatario, vacantesNuevas, opciones = {}) {
  if (!destinatario) throw new Error('enviarAPersona necesita un destinatario');
  if (!Array.isArray(vacantesNuevas) || vacantesNuevas.length === 0) return null;

  validarConfiguracion();

  const etiqueta = opciones.etiqueta || ESPECIALIDAD_BUSCADA;
  const asunto = `${vacantesNuevas.length} vacante(s) nueva(s) de ${etiqueta} en el MEP`;

  const info = await obtenerTransporter().sendMail({
    from: `"${EMAIL_FROM_NOMBRE}" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: asunto,
    text: construirTextoPlano(vacantesNuevas, etiqueta, opciones),
    html: construirHtml(vacantesNuevas, etiqueta, opciones),
  });

  console.log(`[mailer] Correo enviado a ${destinatario} (${vacantesNuevas.length} vacante(s)).`);
  return info;
}

async function enviarResumen({ para, vacantes, etiqueta, urlBaja }) {
  if (!para) throw new Error('enviarResumen necesita un destinatario');
  if (!Array.isArray(vacantes) || vacantes.length === 0) return null;

  validarConfiguracion();

  const lista = etiqueta || ESPECIALIDAD_BUSCADA;
  const total = vacantes.length;

  const html = construirHtml(vacantes, lista, {
    urlBaja,
    titulo: `Hay ${total} vacante(s) abierta(s)`,
    encabezado: `Hay ${total} vacante(s) abierta(s) de ${lista}`,
    subtitulo: `${total} vacante(s) publicada(s) ahora mismo que te interesan.`,
  });

  const texto = construirTextoPlano(vacantes, lista, { urlBaja }).replace(
    `Vacantes nuevas de ${lista}`,
    `Hay ${total} vacante(s) abierta(s) de ${lista}`,
  );

  const info = await obtenerTransporter().sendMail({
    from: `"${EMAIL_FROM_NOMBRE}" <${process.env.EMAIL_USER}>`,
    to: para,
    subject: `Hay ${total} vacante(s) abierta(s) de ${lista} en el MEP`,
    text: texto,
    html,
  });

  console.log(`[mailer] Resumen enviado a ${para} (${vacantes.length} vacante(s) abierta(s)).`);
  return info;
}

async function enviarAlerta(vacantesNuevas) {
  if (!Array.isArray(vacantesNuevas) || vacantesNuevas.length === 0) {
    console.log('[mailer] No hay vacantes nuevas. No se envia correo.');
    return null;
  }

  validarConfiguracion(true);

  const asunto = `${vacantesNuevas.length} vacante(s) nueva(s) de ${ESPECIALIDAD_BUSCADA} en el MEP`;

  const info = await obtenerTransporter().sendMail({
    from: `"${EMAIL_FROM_NOMBRE}" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: asunto,
    text: construirTextoPlano(vacantesNuevas),
    html: construirHtml(vacantesNuevas),
  });

  console.log(`[mailer] Correo enviado a ${process.env.EMAIL_TO} (${vacantesNuevas.length} vacante(s)).`);
  console.log(`[mailer] messageId: ${info.messageId}`);

  return info;
}

module.exports = {
  enviarAlerta,
  enviarAPersona,
  enviarResumen,
  construirHtml,
  construirTextoPlano,
};
