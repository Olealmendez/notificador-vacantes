const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { tokenBaja: calcularTokenBaja, urlBaja: calcularUrlBaja } = require('../tokens');

const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const APP_SECRET = process.env.APP_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_SUSCRIPTORES = Number(process.env.MAX_SUSCRIPTORES || 200);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const NOMBRE_REMITENTE = process.env.EMAIL_FROM_NOMBRE || 'Avisos de Vacantes MEP';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

let transporter = null;

function permitirCORS(req, res) {
  const origen = req.headers.origin;
  if (origen) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function errorApi(res, codigo, mensaje, extra = {}) {
  return res.status(codigo).json({ ok: false, error: mensaje, ...extra });
}

function tokenAleatorio() {
  return crypto.randomBytes(24).toString('hex');
}

function tokenBaja(correo) {
  return calcularTokenBaja(correo);
}

function normalizar(texto) {
  return String(texto ?? '')
    .trim()
    .toLowerCase();
}

function urlConfirmar(token) {
  return `${APP_URL}/api/confirmar?token=${encodeURIComponent(token)}`;
}

function urlBaja(correo) {
  return calcularUrlBaja(correo);
}

function verificarAdmin(req) {
  const recibido = req.headers['x-admin-password'];
  if (!ADMIN_PASSWORD) return { ok: false, motivo: 'Falta ADMIN_PASSWORD en Vercel' };
  if (!recibido) return { ok: false, motivo: 'Falta la contrasena' };

  const a = crypto.createHash('sha256').update(String(recibido)).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();

  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, motivo: 'Contrasena incorrecta' };
}

function obtenerTransporter() {
  if (transporter) return transporter;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Faltan EMAIL_USER o EMAIL_PASS en las variables de Vercel');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return transporter;
}

async function enviarConfirmacion({ correo, tokenConfirmacion, especialidades }) {
  const enlace = urlConfirmar(tokenConfirmacion);
  const lista = especialidades.length > 0 ? especialidades.join(', ') : 'todas las especialidades';

  return obtenerTransporter().sendMail({
    from: `"${NOMBRE_REMITENTE}" <${EMAIL_USER}>`,
    to: correo,
    subject: 'Confirma tu suscripcion a los avisos de vacantes del MEP',
    text: [
      'Hola,',
      '',
      'Para empezar a recibir avisos de vacantes hay que confirmar esta direccion.',
      '',
      `Especialidades que elegiste: ${lista}`,
      '',
      `Confirmar: ${enlace}`,
      '',
      'Si no te suscribiste tu, borra este mensaje y no pasa nada.',
      'El enlace vence en 7 dias.',
    ].join('\n'),
    html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Confirma tu suscripcion</title></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#202124;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);">
    <div style="background:#1a73e8;padding:20px 24px;">
      <h1 style="margin:0;font-size:19px;color:#fff;">Falta una confirmacion</h1>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.6;">
      <p>Hola, para empezar a recibir avisos de vacantes hay que confirmar esta direccion de correo.</p>
      <p style="background:#f1f3f4;border-radius:6px;padding:12px 14px;margin:18px 0;">
        <strong>Especialidades que elegiste:</strong><br>${escapar(lista)}
      </p>
      <p style="text-align:center;margin:26px 0;">
        <a href="${escapar(enlace)}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:13px 26px;border-radius:6px;display:inline-block;font-weight:600;">Confirmar suscripcion</a>
      </p>
      <p style="color:#5f6368;font-size:13px;">Si el boton no funciona, copia esta direccion en tu navegador:<br>
        <span style="word-break:break-all;">${escapar(enlace)}</span>
      </p>
      <p style="color:#5f6368;font-size:13px;">Si no te suscribiste tu, borra este mensaje y no pasa nada. El enlace vence en 7 dias.</p>
    </div>
  </div>
</body></html>`,
  });
}

function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function correoValido(correo) {
  return REGEX_CORREO.test(String(correo ?? '').trim());
}

module.exports = {
  APP_URL,
  APP_SECRET,
  ADMIN_PASSWORD,
  MAX_SUSCRIPTORES,
  EMAIL_USER,
  NOMBRE_REMITENTE,
  permitirCORS,
  errorApi,
  tokenAleatorio,
  tokenBaja,
  normalizar,
  urlConfirmar,
  urlBaja,
  verificarAdmin,
  enviarConfirmacion,
  obtenerTransporter,
  correoValido,
  escapar,
};
