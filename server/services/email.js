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

async function sendWelcome(to, name) {
  const transport = createTransport();
  const firstName = (name || to).split(' ')[0];
  await transport.sendMail({
    from: `TollSync <${FROM()}>`,
    to,
    subject: 'Welcome to TollSync ⚡',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
        <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
          <h2 style="margin:0 0 4px;font-size:22px;color:#1a1a1a">⚡ Welcome to TollSync, ${firstName}!</h2>
          <p style="color:#888;font-size:14px;margin:0 0 24px">Your account is ready. Here's how to get started:</p>

          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="width:32px;height:32px;border-radius:50%;background:#185fa5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">1</div>
              <div>
                <p style="font-weight:600;font-size:14px;margin:0 0 2px;color:#1a1a1a">Add your vehicles</p>
                <p style="font-size:13px;color:#888;margin:0">Enter each car you host with its license plate and EZ-Pass transponder ID.</p>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="width:32px;height:32px;border-radius:50%;background:#185fa5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">2</div>
              <div>
                <p style="font-weight:600;font-size:14px;margin:0 0 2px;color:#1a1a1a">Upload your EZ-Pass statement</p>
                <p style="font-size:13px;color:#888;margin:0">Drop in your PDF or CSV — our AI parses it automatically.</p>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="width:32px;height:32px;border-radius:50%;background:#185fa5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">3</div>
              <div>
                <p style="font-weight:600;font-size:14px;margin:0 0 2px;color:#1a1a1a">Calculate toll charges</p>
                <p style="font-size:13px;color:#888;margin:0">Paste a trip, pick the date range, and get the exact toll amount to charge your renter.</p>
              </div>
            </div>
          </div>

          <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Open TollSync →
          </a>

          <p style="color:#aaa;font-size:12px;margin-top:28px">
            Questions? Reply to this email or chat with us on WhatsApp — we're happy to help.<br/>
            — The TollSync team
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendPasswordReset, sendWelcome };
