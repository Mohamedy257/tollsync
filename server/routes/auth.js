const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Host = require('../models/Host');
const PlanConfig = require('../models/PlanConfig');

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
  try {
    const existing = await Host.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const host = await Host.create({ email, password_hash: hash, name: name || null, setup_complete: false });
    const token = issueToken(host.id);
    res.json({ token, host: serializeHost(host) });
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
    if (!host) return res.status(401).json({ error: 'Invalid credentials' });
    if (!host.password_hash) return res.status(401).json({ error: `This account uses ${host.oauth_provider || 'social'} login. Please sign in with that provider.` });
    const valid = await bcrypt.compare(password, host.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clientUrl() {
  return (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function googleCallbackUrl() {
  const base = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base}/api/auth/google/callback`;
}

function facebookCallbackUrl() {
  const base = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base}/api/auth/facebook/callback`;
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
  });
  return host;
}

module.exports = router;
