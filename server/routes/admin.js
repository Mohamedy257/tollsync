const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const Host = require('../models/Host');
const PlanConfig = require('../models/PlanConfig');
const ContactMessage = require('../models/ContactMessage');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const TripResult = require('../models/TripResult');
const GmailToken = require('../models/GmailToken');
const GmailConfig = require('../models/GmailConfig');
const EzpassReportRange = require('../models/EzpassReportRange');
const { sendCustom } = require('../services/email');

const router = express.Router();
router.use(auth);

// Require admin middleware
async function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!adminEmail) return res.status(403).json({ error: 'Admin not configured (set ADMIN_EMAIL env var)' });
  const host = await Host.findById(req.hostId);
  if (!host || host.email !== adminEmail) return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function getStripe() {
  const plan = await PlanConfig.findOne();
  const key = plan?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe secret key not configured. Set it in Admin > Stripe Configuration.');
  return require('stripe')(key);
}

// GET /api/admin/config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const plan = await PlanConfig.findOne() || {};
    res.json({
      name: plan.name || 'TollSync Pro',
      description: plan.description || '',
      price_cents: plan.price_cents || 1000,
      trial_days: plan.trial_days ?? 0,
      stripe_price_id: plan.stripe_price_id || process.env.STRIPE_PRICE_ID || null,
      stripe_product_id: plan.stripe_product_id || null,
      // Never expose actual key values — only whether they're set
      stripe_secret_key_set: !!(plan.stripe_secret_key || process.env.STRIPE_SECRET_KEY),
      stripe_publishable_key: plan.stripe_publishable_key || process.env.STRIPE_PUBLISHABLE_KEY || '',
      stripe_webhook_secret_set: !!(plan.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET),
      // Legal
      terms_text: plan.terms_text || '',
      // Contact
      whatsapp_number: plan.whatsapp_number || '16673598525',
      support_email: plan.support_email || '',
      // OAuth
      google_oauth_enabled: !!plan.google_oauth_enabled,
      google_client_id: plan.google_client_id || '',
      google_client_secret_set: !!plan.google_client_secret,
      facebook_oauth_enabled: !!plan.facebook_oauth_enabled,
      facebook_app_id: plan.facebook_app_id || '',
      facebook_app_secret_set: !!plan.facebook_app_secret,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config — update plan; creates new Stripe price if price changed
router.put('/config', requireAdmin, async (req, res) => {
  try {
    const {
      name, description, price_cents, trial_days,
      stripe_secret_key, stripe_publishable_key, stripe_webhook_secret, stripe_price_id: manualPriceId,
      google_oauth_enabled, google_client_id, google_client_secret,
      facebook_oauth_enabled, facebook_app_id, facebook_app_secret,
      whatsapp_number, support_email, terms_text,
    } = req.body;
    const existing = await PlanConfig.findOne();

    // Build Stripe key updates (only overwrite if a non-empty value was submitted)
    const keyUpdates = {};
    if (stripe_secret_key && stripe_secret_key.trim()) keyUpdates.stripe_secret_key = stripe_secret_key.trim();
    if (stripe_publishable_key !== undefined) keyUpdates.stripe_publishable_key = stripe_publishable_key.trim();
    if (stripe_webhook_secret && stripe_webhook_secret.trim()) keyUpdates.stripe_webhook_secret = stripe_webhook_secret.trim();
    if (manualPriceId && manualPriceId.trim()) keyUpdates.stripe_price_id = manualPriceId.trim();

    let stripe_price_id = keyUpdates.stripe_price_id || existing?.stripe_price_id || process.env.STRIPE_PRICE_ID || null;
    let stripe_product_id = existing?.stripe_product_id || null;
    const newPriceCents = parseInt(price_cents, 10);

    // Only auto-create price if price_cents changed AND no manual price ID was provided
    if (newPriceCents && newPriceCents !== existing?.price_cents && !keyUpdates.stripe_price_id) {
      // Use the incoming secret key if provided, otherwise fall back to existing
      const secretKey = keyUpdates.stripe_secret_key || existing?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
      if (!secretKey) throw new Error('Stripe secret key not configured.');
      const stripe = require('stripe')(secretKey);
      // Ensure product exists
      if (!stripe_product_id) {
        const product = await stripe.products.create({ name: name || 'TollSync Pro' });
        stripe_product_id = product.id;
      }
      // Create new price
      const price = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: newPriceCents,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      // Archive old price
      if (stripe_price_id) {
        await stripe.prices.update(stripe_price_id, { active: false }).catch(() => {});
      }
      stripe_price_id = price.id;
    }

    // Legal updates
    const legalUpdates = {};
    if (terms_text !== undefined) legalUpdates.terms_text = terms_text || null;

    // Contact updates
    const contactUpdates = {};
    if (whatsapp_number !== undefined) contactUpdates.whatsapp_number = whatsapp_number.trim().replace(/^\+/, '');
    if (support_email !== undefined) contactUpdates.support_email = support_email.trim() || null;

    // OAuth updates — only overwrite secrets if non-empty value submitted
    const oauthUpdates = {};
    if (google_oauth_enabled !== undefined) oauthUpdates.google_oauth_enabled = !!google_oauth_enabled;
    if (google_client_id !== undefined) oauthUpdates.google_client_id = google_client_id.trim();
    if (google_client_secret && google_client_secret.trim()) oauthUpdates.google_client_secret = google_client_secret.trim();
    if (facebook_oauth_enabled !== undefined) oauthUpdates.facebook_oauth_enabled = !!facebook_oauth_enabled;
    if (facebook_app_id !== undefined) oauthUpdates.facebook_app_id = facebook_app_id.trim();
    if (facebook_app_secret && facebook_app_secret.trim()) oauthUpdates.facebook_app_secret = facebook_app_secret.trim();

    const { stripe_price_id: _ignored, ...restKeyUpdates } = keyUpdates;
    const plan = await PlanConfig.findOneAndUpdate(
      {},
      {
        name: name || 'TollSync Pro',
        description: description || '',
        price_cents: newPriceCents || existing?.price_cents || 1000,
        trial_days: trial_days !== undefined ? parseInt(trial_days, 10) : (existing?.trial_days ?? 0),
        stripe_price_id,
        stripe_product_id,
        ...restKeyUpdates,
        ...legalUpdates,
        ...contactUpdates,
        ...oauthUpdates,
      },
      { upsert: true, new: true }
    );

    res.json({ plan });
  } catch (err) {
    console.error('Admin config error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/create-price — force create a Stripe price from current plan settings
router.post('/create-price', requireAdmin, async (req, res) => {
  try {
    const existing = await PlanConfig.findOne();
    const secretKey = existing?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return res.status(400).json({ error: 'Stripe secret key not configured.' });

    const stripe = require('stripe')(secretKey);
    const priceCents = existing?.price_cents || 1000;
    const name = existing?.name || 'TollSync Pro';

    let stripe_product_id = existing?.stripe_product_id || null;
    if (!stripe_product_id) {
      const product = await stripe.products.create({ name });
      stripe_product_id = product.id;
    }

    // Archive existing price if any
    if (existing?.stripe_price_id) {
      await stripe.prices.update(existing.stripe_price_id, { active: false }).catch(() => {});
    }

    const price = await stripe.prices.create({
      product: stripe_product_id,
      unit_amount: priceCents,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const plan = await PlanConfig.findOneAndUpdate(
      {},
      { stripe_price_id: price.id, stripe_product_id },
      { upsert: true, new: true }
    );

    res.json({ stripe_price_id: plan.stripe_price_id });
  } catch (err) {
    console.error('Create price error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/subscribers
router.get('/subscribers', requireAdmin, async (req, res) => {
  try {
    const subscribers = await Host.find({})
      .select('email name subscription_status subscription_current_period_end stripe_subscription_id createdAt')
      .sort({ createdAt: -1 });
    res.json({ subscribers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/grant/:hostId — manually grant subscription (for testing/comps)
router.post('/grant/:hostId', requireAdmin, async (req, res) => {
  try {
    const host = await Host.findByIdAndUpdate(
      req.params.hostId,
      { subscription_status: 'active', subscription_current_period_end: null },
      { new: true }
    );
    if (!host) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/revoke/:hostId — revoke subscription
router.post('/revoke/:hostId', requireAdmin, async (req, res) => {
  try {
    const host = await Host.findByIdAndUpdate(
      req.params.hostId,
      { subscription_status: 'none' },
      { new: true }
    );
    if (!host) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/messages — inbox of contact form submissions
router.get('/messages', requireAdmin, async (req, res) => {
  try {
    const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).limit(200);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/messages/:id/read
router.post('/messages/:id/read', requireAdmin, async (req, res) => {
  try {
    await ContactMessage.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/impersonate/:hostId — generate a short-lived token scoped to another user
router.post('/impersonate/:hostId', requireAdmin, async (req, res) => {
  try {
    const adminId = req.hostId;
    const target = await Host.findById(req.params.hostId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Refuse to impersonate another admin
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (target.email === adminEmail) return res.status(403).json({ error: 'Cannot impersonate admin' });

    const token = jwt.sign(
      { hostId: target.id, impersonatedBy: adminId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token, host: { id: target.id, email: target.email, name: target.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:hostId — permanently delete a user and all their data
router.delete('/users/:hostId', requireAdmin, async (req, res) => {
  try {
    const { hostId } = req.params;
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const target = await Host.findById(hostId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === adminEmail) return res.status(403).json({ error: 'Cannot delete admin account' });

    await Promise.all([
      Vehicle.deleteMany({ host_id: hostId }),
      Trip.deleteMany({ host_id: hostId }),
      TollTransaction.deleteMany({ host_id: hostId }),
      TripResult.deleteMany({ host_id: hostId }),
      GmailToken.deleteMany({ host_id: hostId }),
      GmailConfig.deleteMany({ host_id: hostId }),
      EzpassReportRange.deleteMany({ host_id: hostId }),
    ]);
    await Host.findByIdAndDelete(hostId);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/tolls — wipe all toll transactions across all users
router.delete('/tolls', requireAdmin, async (req, res) => {
  try {
    const result = await TollTransaction.deleteMany({});
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email/:hostId — send a custom email to a user
router.post('/email/:hostId', requireAdmin, async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

    const target = await Host.findById(req.params.hostId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await sendCustom(target.email, subject, body);
    res.json({ success: true });
  } catch (err) {
    console.error('Send email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
