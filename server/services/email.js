const { Resend } = require('resend');

const FROM = () => process.env.SMTP_FROM || 'TollSync <onboarding@resend.dev>';
const APP_URL = () => process.env.CLIENT_URL || 'http://localhost:3000';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email not configured. Set RESEND_API_KEY environment variable.');
  return new Resend(apiKey);
}

async function sendPasswordReset(to, token) {
  const link = `${APP_URL()}/reset-password?token=${token}`;
  const resend = getResend();
  await resend.emails.send({
    from: FROM(),
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

async function sendVerificationEmail(to, token, name) {
  const firstName = (name || to).split(' ')[0];
  const link = `${APP_URL()}/verify-email?token=${token}`;
  const resend = getResend();
  await resend.emails.send({
    from: FROM(),
    to,
    subject: 'Verify your TollSync email ⚡',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
        <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
          <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a">⚡ Welcome to TollSync, ${firstName}!</h2>
          <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6">
            You're almost ready. Click the button below to verify your email address and activate your account.
          </p>
          <a href="${link}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Verify my email →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">
            This link expires in 24 hours. If you didn't create a TollSync account, you can safely ignore this email.
          </p>
          <p style="color:#ccc;font-size:11px;margin-top:8px">Or copy this link: ${link}</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcome(to, name) {
  const firstName = (name || to).split(' ')[0];
  const resend = getResend();
  await resend.emails.send({
    from: FROM(),
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

async function sendCustom(to, subject, body) {
  const htmlBody = body.replace(/\n/g, '<br>');
  const resend = getResend();
  await resend.emails.send({
    from: FROM(),
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
        <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
          <h2 style="margin:0 0 20px;font-size:18px;color:#1a1a1a">⚡ TollSync</h2>
          <div style="font-size:14px;color:#333;line-height:1.7">${htmlBody}</div>
          <p style="color:#aaa;font-size:12px;margin-top:28px">— The TollSync team</p>
        </div>
      </div>
    `,
    text: body,
  });
}

module.exports = { sendPasswordReset, sendWelcome, sendVerificationEmail, sendCustom };
