const FROM = () => process.env.SMTP_FROM || 'TollSync <support@tollsync.app>';
const REPLY_TO = () => process.env.REPLY_TO_EMAIL || process.env.ADMIN_EMAIL || 'support@tollsync.app';
const APP_URL = () => process.env.CLIENT_URL || 'http://localhost:3000';

const EMAIL_FOOTER = () => `
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e3de;text-align:center;font-size:11px;color:#aaa;line-height:1.8">
    <p style="margin:0">TollSync &mdash; Rental toll calculator for Turo hosts</p>
    <p style="margin:4px 0">© ${new Date().getFullYear()} TollSync. All rights reserved.</p>
    <p style="margin:4px 0">
      <a href="${APP_URL()}/unsubscribe" style="color:#aaa;text-decoration:underline">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="${APP_URL()}/support" style="color:#aaa;text-decoration:underline">Support</a>
    </p>
  </div>`;

function wrapDocument(inner) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <title></title>
</head>
<body style="margin:0;padding:0;background:#f8f7f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7f4">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px">
        <tr><td>
          ${inner}
          ${EMAIL_FOOTER()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function htmlToText(html) {
  return html
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2: $1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email not configured. Set RESEND_API_KEY environment variable.');

  const finalHtml = wrapDocument(html);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM(),
      to,
      subject,
      html: finalHtml,
      text: htmlToText(finalHtml),
      reply_to: REPLY_TO(),
      headers: {
        'List-Unsubscribe': `<mailto:${REPLY_TO()}?subject=unsubscribe>, <${APP_URL()}/unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendPasswordReset(to, token) {
  const link = `${APP_URL()}/reset-password?token=${token}`;
  await sendEmail(to, 'Reset your TollSync password', `
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
  `);
}

async function sendVerificationEmail(to, token, name) {
  const firstName = (name || to).split(' ')[0];
  const link = `${APP_URL()}/verify-email?token=${token}`;
  await sendEmail(to, 'Please verify your TollSync email address', `
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
  `);
}

async function sendWelcome(to, name) {
  const firstName = (name || to).split(' ')[0];
  await sendEmail(to, 'Welcome to TollSync', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <h2 style="margin:0 0 4px;font-size:22px;color:#1a1a1a">⚡ Welcome to TollSync, ${firstName}!</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">Your account is ready. Here's how to get started:</p>

        <div style="margin-bottom:28px">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
            <div style="width:32px;height:32px;border-radius:50%;background:#185fa5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">1</div>
            <div>
              <p style="font-weight:600;font-size:14px;margin:0 0 2px;color:#1a1a1a">Add your vehicles</p>
              <p style="font-size:13px;color:#888;margin:0">Enter each car you host with its license plate and EZ-Pass transponder ID.</p>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
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
  `);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtAmount(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

async function sendSubscriptionWelcome(to, name, planName, priceCents, periodEnd, trialDays) {
  const firstName = (name || to).split(' ')[0];
  const isTrial = trialDays > 0;
  const billingLine = isTrial
    ? `Your <strong>${trialDays}-day free trial</strong> ends on <strong>${fmtDate(periodEnd)}</strong>, then ${fmtAmount(priceCents)}/month.`
    : `You'll be billed <strong>${fmtAmount(priceCents)}/month</strong>. Next charge: <strong>${fmtDate(periodEnd)}</strong>.`;

  await sendEmail(to, `Your TollSync subscription is active`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <div style="background:linear-gradient(135deg,#185fa5,#1577d4);border-radius:10px;padding:18px 20px;margin-bottom:24px">
          <p style="margin:0;font-size:20px;font-weight:800;color:#fff">⚡ ${planName || 'TollSync Pro'}</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">Subscription active</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">You're all set, ${firstName}!</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">${billingLine}</p>

        <div style="background:#f0f4fa;border-radius:10px;padding:16px 18px;margin-bottom:24px">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">What's included</p>
          ${['Unlimited trip & toll uploads', 'AI-powered file parsing (screenshots, PDFs, CSVs)', 'Auto toll matching to trips', 'Per-renter toll reports with export', 'Gmail sync for trip data'].map(f => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="color:#185fa5;font-size:14px;font-weight:700">✓</span>
            <span style="font-size:13px;color:#374151">${f}</span>
          </div>`).join('')}
        </div>

        <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Open TollSync →
        </a>

        <p style="color:#aaa;font-size:12px;margin-top:24px;line-height:1.6">
          Questions? Reply to this email — we're happy to help.<br/>— The TollSync team
        </p>
      </div>
    </div>
  `);
}

async function sendCancellation(to, name, periodEnd) {
  const firstName = (name || to).split(' ')[0];
  await sendEmail(to, 'Your TollSync subscription has been canceled', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">We're sorry to see you go, ${firstName}</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">
          Your TollSync subscription has been canceled.
          ${periodEnd ? `You'll retain full access until <strong>${fmtDate(periodEnd)}</strong>.` : 'Your access has ended.'}
        </p>

        <div style="background:#fff8f0;border:1px solid #fde8c8;border-radius:10px;padding:16px 18px;margin-bottom:24px">
          <p style="margin:0;font-size:13px;color:#854f0b;line-height:1.6">
            Changed your mind? You can resubscribe at any time and pick up right where you left off — all your vehicles, trips, and toll records are still saved.
          </p>
        </div>

        <a href="${APP_URL()}/subscribe" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Resubscribe →
        </a>

        <p style="color:#aaa;font-size:12px;margin-top:24px;line-height:1.6">
          If there's something we could improve, reply to this email and let us know.<br/>— The TollSync team
        </p>
      </div>
    </div>
  `);
}

async function sendPaymentFailed(to, name) {
  const firstName = (name || to).split(' ')[0];
  await sendEmail(to, 'Action required: payment failed for your TollSync subscription', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626">⚠️ Payment failed</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">Hi ${firstName}, we couldn't process your payment</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">
          Your TollSync subscription payment failed. Please update your billing information to keep your access uninterrupted.
        </p>
        <a href="${APP_URL()}/billing" style="display:inline-block;padding:13px 28px;background:#dc2626;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Update billing info →
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;line-height:1.6">
          If you continue to have trouble, reply to this email and we'll help sort it out.<br/>— The TollSync team
        </p>
      </div>
    </div>
  `);
}

async function sendSubscriptionRenewed(to, name, periodEnd, amountCents) {
  const firstName = (name || to).split(' ')[0];
  await sendEmail(to, 'Your TollSync subscription has been renewed', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;font-weight:700;color:#15803d">✓ Payment successful</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">Your subscription has renewed, ${firstName}</h2>
        <div style="background:#f8f7f4;border-radius:10px;padding:14px 18px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;color:#6b7280">Plan</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a1a">TollSync Pro</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;color:#6b7280">Amount charged</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a1a">${amountCents ? fmtAmount(amountCents) : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:#6b7280">Next renewal</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a1a">${fmtDate(periodEnd)}</span>
          </div>
        </div>
        <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Open TollSync →
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">— The TollSync team</p>
      </div>
    </div>
  `);
}

async function sendTrialEnding(to, name, trialEndDate) {
  const firstName = (name || to).split(' ')[0];
  await sendEmail(to, 'Your TollSync trial ends in 3 days', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">Your free trial ends soon, ${firstName}</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">
          Your TollSync free trial ends on <strong>${fmtDate(trialEndDate)}</strong>. After that, your subscription will automatically continue at the monthly rate — no action needed.
        </p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">
          To cancel before being charged, go to your billing settings.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Keep using TollSync →
          </a>
          <a href="${APP_URL()}/billing" style="display:inline-block;padding:13px 20px;background:#fff;color:#185fa5;border:1.5px solid #185fa5;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Manage billing
          </a>
        </div>
        <p style="color:#aaa;font-size:12px;margin-top:24px">— The TollSync team</p>
      </div>
    </div>
  `);
}

async function sendAdminNewUser(adminEmail, newUserEmail, newUserName, provider) {
  const via = provider ? `via ${provider}` : 'email/password';
  await sendEmail(adminEmail, `New signup: ${newUserEmail}`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:24px;border:0.5px solid #e5e3de">
        <h2 style="margin:0 0 16px;font-size:17px;color:#1a1a1a">⚡ New TollSync signup</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 0;color:#6b7280;width:90px">Name</td><td style="padding:6px 0;font-weight:600;color:#111">${newUserName || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0;font-weight:600;color:#111">${newUserEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Signed up</td><td style="padding:6px 0;color:#111">${via}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Time</td><td style="padding:6px 0;color:#111">${new Date().toUTCString()}</td></tr>
        </table>
        <a href="${APP_URL()}/admin" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#185fa5;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
          View in Admin →
        </a>
      </div>
    </div>
  `);
}

async function sendFreeTrialGranted(to, name, trialEndsAt, trialDays) {
  const firstName = (name || to).split(' ')[0];
  const endDate = fmtDate(trialEndsAt);
  await sendEmail(to, `You have ${trialDays}-day free access to TollSync`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <div style="background:linear-gradient(135deg,#185fa5,#1577d4);border-radius:10px;padding:18px 20px;margin-bottom:24px">
          <p style="margin:0;font-size:20px;font-weight:800;color:#fff">⚡ TollSync</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">Free trial — no credit card required</p>
        </div>

        <h2 style="margin:0 0 10px;font-size:20px;color:#1a1a1a">Hi ${firstName}, your free trial is ready!</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6">
          You have full access to TollSync for <strong>${trialDays} days</strong>, completely free — no credit card needed.
          Your trial runs until <strong>${endDate}</strong>.
        </p>

        <div style="background:#f0f4fa;border-radius:10px;padding:16px 18px;margin-bottom:24px">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">What you can do</p>
          ${['Upload trip screenshots, PDFs, CSVs, or Excel files', 'Upload EZ-Pass / toll statements', 'AI matches tolls to each renter automatically', 'Get exact per-renter toll amounts to charge back', 'Export reports for your records'].map(f => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="color:#185fa5;font-size:14px;font-weight:700">✓</span>
            <span style="font-size:13px;color:#374151">${f}</span>
          </div>`).join('')}
        </div>

        <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;background:#185fa5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Open TollSync →
        </a>

        <p style="color:#aaa;font-size:12px;margin-top:24px;line-height:1.6">
          Questions? Reply to this email — we're happy to help.<br/>— The TollSync team
        </p>
      </div>
    </div>
  `);
}

async function sendCustom(to, subject, body) {
  const htmlBody = body.replace(/\n/g, '<br>');
  await sendEmail(to, subject, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;background:#f8f7f4">
      <div style="background:#fff;border-radius:16px;padding:32px;border:0.5px solid #e5e3de">
        <h2 style="margin:0 0 20px;font-size:18px;color:#1a1a1a">⚡ TollSync</h2>
        <div style="font-size:14px;color:#333;line-height:1.7">${htmlBody}</div>
        <p style="color:#aaa;font-size:12px;margin-top:28px">— The TollSync team</p>
      </div>
    </div>
  `);
}

module.exports = {
  sendPasswordReset, sendWelcome, sendVerificationEmail, sendCustom,
  sendSubscriptionWelcome, sendCancellation, sendPaymentFailed,
  sendSubscriptionRenewed, sendTrialEnding, sendAdminNewUser,
  sendFreeTrialGranted,
};
