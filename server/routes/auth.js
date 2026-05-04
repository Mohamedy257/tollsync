const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Host = require('../models/Host');
const FunnelEvent = require('../models/FunnelEvent');
const { sendPasswordReset, sendWelcome, sendVerificationEmail, sendAdminNewUser } = require('../services/email');
const PlanConfig = require('../models/PlanConfig');
const auth = require('../middleware/auth');

const router = express.Router();

function serializeHost(host) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  return {
    id: host.id,
    email: host.email,
    name: host.name,
    setup_complete: host.setup_complete,
    subscription_status: host.subscription_status || 'none',
    subscription_current_period_end: host.subscription_current_period_end || null,
    is_admin: !!(adminEmail && host.email === adminEmail),
    oauth_provider: host.oauth_provider || null,
    // null = pre-feature user (treat as verified), false = pending, true = verified
    email_verified: host.email_verified,
    free_trial_ends_at: host.free_trial_ends_at || null,
  };
}

function issueToken(hostId, extra = {}) {
  return jwt.sign({ hostId, ...extra }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// GET /api/auth/oauth-providers — public: which providers are enabled
router.get('/oauth-providers', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne();
    res.json({
      google: !!(plan?.google_oauth_enabled && plan?.google_client_id),
      facebook: !!(plan?.facebook_oauth_enabled && plan?.facebook_app_id),
    });
  } catch {
    res.json({ google: false, facebook: false });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
  if (!/[a-z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one lowercase letter.' });
  if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one number.' });
  if (!/[^A-Za-z0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one special character.' });
  try {
    const existing = await Host.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const plan = await PlanConfig.findOne();
    const freeTrialDays = plan?.free_trial_days ?? 7;
    const free_trial_ends_at = freeTrialDays > 0
      ? new Date(Date.now() + freeTrialDays * 24 * 60 * 60 * 1000)
      : null;
    const host = await Host.create({
      email, password_hash: hash, name: name || null,
      setup_complete: false,
      email_verified: false,
      email_verification_token: verificationToken,
      free_trial_ends_at,
    });
    const token = issueToken(host.id);
    res.json({ token, host: serializeHost(host) });
    // Send verification email — fire and forget
    sendVerificationEmail(host.email, verificationToken, host.name)
      .then(() => console.log('Verification email sent to', host.email))
      .catch(err => console.error('Verification email FAILED for', host.email, ':', err.message));
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (adminEmail) sendAdminNewUser(adminEmail, host.email, host.name, null).catch(() => {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const host = await Host.findOne({ email: email.toLowerCase() });
    if (!host) return res.status(401).json({ error: 'No account found with that email. Would you like to create one?', code: 'EMAIL_NOT_FOUND' });
    if (!host.password_hash) return res.status(401).json({ error: `This account uses ${host.oauth_provider || 'social'} login. Please sign in with that provider.` });
    const valid = await bcrypt.compare(password, host.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });
    const token = issueToken(host.id);
    res.json({ token, host: serializeHost(host) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/complete-setup
router.post('/complete-setup', require('../middleware/auth'), async (req, res) => {
  const host = await Host.findByIdAndUpdate(req.hostId, { setup_complete: true }, { new: true });
  res.json({ host: serializeHost(host) });
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const host = await Host.findById(req.hostId);
  if (!host) return res.status(404).json({ error: 'Host not found' });
  const data = { host: serializeHost(host) };
  if (req.impersonatedBy) data.impersonatedBy = req.impersonatedBy;
  res.json(data);
});

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get('/google', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne();
    if (!plan?.google_oauth_enabled || !plan?.google_client_id) {
      return res.redirect(`${clientUrl()}/login?error=Google+login+is+not+enabled`);
    }
    const params = new URLSearchParams({
      client_id: plan.google_client_id,
      redirect_uri: googleCallbackUrl(),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (err) {
    res.redirect(`${clientUrl()}/login?error=OAuth+error`);
  }
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl()}/login?error=Google+login+cancelled`);

  try {
    const plan = await PlanConfig.findOne();
    if (!plan?.google_client_id || !plan?.google_client_secret) throw new Error('Not configured');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: plan.google_client_id,
        client_secret: plan.google_client_secret,
        redirect_uri: googleCallbackUrl(),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token from Google');

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();
    if (!profile.email) throw new Error('No email from Google');

    const host = await findOrCreateOAuthUser({
      email: profile.email,
      name: profile.name || profile.email,
      provider: 'google',
      providerId: profile.sub,
      field: 'google_id',
    });

    const token = issueToken(host.id);
    res.redirect(`${clientUrl()}/oauth-callback?token=${token}`);
  } catch (err) {
    console.error('Google callback error:', err.message);
    res.redirect(`${clientUrl()}/login?error=Google+login+failed`);
  }
});

// ─── Facebook OAuth ───────────────────────────────────────────────────────────

router.get('/facebook', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne();
    if (!plan?.facebook_oauth_enabled || !plan?.facebook_app_id) {
      return res.redirect(`${clientUrl()}/login?error=Facebook+login+is+not+enabled`);
    }
    const params = new URLSearchParams({
      client_id: plan.facebook_app_id,
      redirect_uri: facebookCallbackUrl(),
      response_type: 'code',
      scope: 'email',
    });
    res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`);
  } catch (err) {
    res.redirect(`${clientUrl()}/login?error=OAuth+error`);
  }
});

router.get('/facebook/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl()}/login?error=Facebook+login+cancelled`);

  try {
    const plan = await PlanConfig.findOne();
    if (!plan?.facebook_app_id || !plan?.facebook_app_secret) throw new Error('Not configured');

    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: plan.facebook_app_id,
        client_secret: plan.facebook_app_secret,
        redirect_uri: facebookCallbackUrl(),
        code,
      })
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token from Facebook');

    // Fetch user info
    const userRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );
    const profile = await userRes.json();
    if (!profile.email) throw new Error('No email from Facebook — ensure email permission is granted');

    const host = await findOrCreateOAuthUser({
      email: profile.email,
      name: profile.name || profile.email,
      provider: 'facebook',
      providerId: profile.id,
      field: 'facebook_id',
    });

    const token = issueToken(host.id);
    res.redirect(`${clientUrl()}/oauth-callback?token=${token}`);
  } catch (err) {
    console.error('Facebook callback error:', err.message);
    res.redirect(`${clientUrl()}/login?error=Facebook+login+failed`);
  }
});

// ─── Email verification ───────────────────────────────────────────────────────

// GET /api/auth/verify-email?token=xxx — public link from email
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const host = await Host.findOne({ email_verification_token: token });
    if (!host) return res.status(400).json({ error: 'Invalid or expired verification link.' });
    host.email_verified = true;
    host.email_verification_token = null;
    await host.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/resend-verification — auth required
router.post('/resend-verification', auth, async (req, res) => {
  try {
    const host = await Host.findById(req.hostId);
    if (!host) return res.status(404).json({ error: 'User not found' });
    if (host.email_verified) return res.json({ ok: true }); // already verified
    const token = crypto.randomBytes(32).toString('hex');
    host.email_verification_token = token;
    await host.save();
    // Respond immediately — don't block on SMTP
    res.json({ ok: true });
    sendVerificationEmail(host.email, token, host.name)
      .then(() => console.log('Resent verification email to', host.email))
      .catch(err => console.error('Resend verification FAILED for', host.email, ':', err.message));
  } catch (err) {
    console.error('Resend verification error:', err.message);
    res.status(500).json({ error: 'Failed to resend. Please try again.' });
  }
});

// ─── Password reset ──────────────────────────────────────────────────────────

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const host = await Host.findOne({ email: email.toLowerCase() });
    // Always respond OK so we don't leak whether an email is registered
    if (!host || !host.password_hash) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    host.reset_token = token;
    host.reset_token_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await host.save();

    const APP_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetLink = `${APP_URL}/reset-password?token=${token}`;
    try {
      await sendPasswordReset(host.email, token);
      res.json({ ok: true });
    } catch (emailErr) {
      console.error('Forgot password email error:', emailErr.message);
      // Email delivery failed (e.g. unverified domain) — return the link directly
      // so the user can still reset their password
      res.json({ ok: true, reset_link: resetLink });
    }
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.json({ ok: true });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const host = await Host.findOne({
      reset_token: token,
      reset_token_expires: { $gt: new Date() },
    });
    if (!host) return res.status(400).json({ error: 'Reset link is invalid or has expired' });

    host.password_hash = await bcrypt.hash(password, 10);
    host.reset_token = null;
    host.reset_token_expires = null;
    await host.save();

    const jwtToken = issueToken(host.id);
    res.json({ token: jwtToken, host: serializeHost(host) });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Account settings ─────────────────────────────────────────────────────────

// PUT /api/auth/account
router.put('/account', require('../middleware/auth'), async (req, res) => {
  const { name, email, current_password, new_password } = req.body;
  try {
    const host = await Host.findById(req.hostId);
    if (!host) return res.status(404).json({ error: 'User not found' });

    // Update name
    if (name !== undefined) host.name = name.trim() || null;

    // Update email
    if (email && email.toLowerCase() !== host.email) {
      const taken = await Host.findOne({ email: email.toLowerCase(), _id: { $ne: host._id } });
      if (taken) return res.status(409).json({ error: 'Email already in use' });
      host.email = email.toLowerCase().trim();
    }

    // Update password
    if (new_password) {
      if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      if (!host.password_hash) return res.status(400).json({ error: 'Cannot set password on a social login account' });
      if (!current_password) return res.status(400).json({ error: 'Current password required' });
      const valid = await bcrypt.compare(current_password, host.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      host.password_hash = await bcrypt.hash(new_password, 10);
    }

    await host.save();
    res.json({ host: serializeHost(host) });
  } catch (err) {
    console.error('Account update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clientUrl() {
  return (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function serverBase() {
  // SERVER_URL takes priority; CLIENT_URL works in production where server & client share a domain
  return (process.env.SERVER_URL || process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

function googleCallbackUrl() {
  return `${serverBase()}/api/auth/google/callback`;
}

function facebookCallbackUrl() {
  return `${serverBase()}/api/auth/facebook/callback`;
}

async function findOrCreateOAuthUser({ email, name, provider, providerId, field }) {
  // Try to find by provider ID first
  let host = await Host.findOne({ [field]: providerId });
  if (host) return host;

  // Try to find by email (link existing account)
  host = await Host.findOne({ email: email.toLowerCase() });
  if (host) {
    host[field] = providerId;
    if (!host.oauth_provider) host.oauth_provider = provider;
    await host.save();
    return host;
  }

  // Create new user
  host = await Host.create({
    email: email.toLowerCase(),
    name,
    [field]: providerId,
    oauth_provider: provider,
    setup_complete: false,
    email_verified: true, // OAuth providers verify the email for us
  });
  sendWelcome(host.email, host.name).catch(err => console.warn('Welcome email failed:', err.message));
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (adminEmail) sendAdminNewUser(adminEmail, host.email, host.name, provider).catch(() => {});
  return host;
}

// POST /api/auth/funnel — lightweight registration funnel tracking (no auth)
router.post('/funnel', async (req, res) => {
  try {
    const { event, email } = req.body;
    if (!['register_start', 'register_submit'].includes(event)) return res.json({ ok: true });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await FunnelEvent.create({ event, email: email?.toLowerCase() || null, ip, user_agent: req.headers['user-agent'] || null });
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

module.exports = router;
