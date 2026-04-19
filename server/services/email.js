const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER;
const APP_URL = () => process.env.CLIENT_URL || 'http://localhost:3000';

async function sendPasswordReset(to, token) {
  const link = `${APP_URL()}/reset-password?token=${token}`;
  const transport = createTransport();
  await transport.sendMail({
    from: `TollSync <${FROM()}>`,
    to,
    subject: 'Reset your TollSync password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
        <h2 style="color:#185fa5">⚡ TollSync</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Reset password
        </a>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="color:#ccc;font-size:12px">Or copy this link: ${link}</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordReset };
