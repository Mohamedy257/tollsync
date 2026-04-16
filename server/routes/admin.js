const express = require('express');
const auth = require('../middleware/auth');
const Host = require('../models/Host');
const PlanConfig = require('../models/PlanConfig');

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

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// GET /api/admin/config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const plan = await PlanConfig.findOne() || {};
    res.json({
      name: plan.name || 'TollSync Pro',
      description: plan.description || '',
      price_cents: plan.price_cents || 1000,
      stripe_price_id: plan.stripe_price_id || process.env.STRIPE_PRICE_ID || null,
      stripe_product_id: plan.stripe_product_id || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config — update plan; creates new Stripe price if price changed
router.put('/config', requireAdmin, async (req, res) => {
  try {
    const { name, description, price_cents } = req.body;
    const existing = await PlanConfig.findOne();
    const stripe = getStripe();

    let stripe_price_id = existing?.stripe_price_id || process.env.STRIPE_PRICE_ID || null;
    let stripe_product_id = existing?.stripe_product_id || null;
    const newPriceCents = parseInt(price_cents, 10);

    if (newPriceCents && newPriceCents !== existing?.price_cents) {
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

    const plan = await PlanConfig.findOneAndUpdate(
      {},
      {
        name: name || 'TollSync Pro',
        description: description || '',
        price_cents: newPriceCents || existing?.price_cents || 1000,
        stripe_price_id,
        stripe_product_id,
      },
      { upsert: true, new: true }
    );

    res.json({ plan });
  } catch (err) {
    console.error('Admin config error:', err.message);
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

module.exports = router;
