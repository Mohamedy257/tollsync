const express = require('express');
const auth = require('../middleware/auth');
const Host = require('../models/Host');
const PlanConfig = require('../models/PlanConfig');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// GET /api/billing/plan — public plan info
router.get('/plan', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne() || {};
    res.json({
      name: plan.name || 'TollSync Pro',
      description: plan.description || 'Unlimited toll calculations for Turo hosts',
      price_cents: plan.price_cents || 1000,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/status — current user subscription
router.get('/status', auth, async (req, res) => {
  try {
    const host = await Host.findById(req.hostId);
    res.json({
      subscription_status: host.subscription_status || 'none',
      subscription_current_period_end: host.subscription_current_period_end || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/checkout — create Stripe checkout session
router.post('/checkout', auth, async (req, res) => {
  try {
    const stripe = getStripe();
    const host = await Host.findById(req.hostId);

    // Get or create Stripe customer
    let customerId = host.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: host.email,
        name: host.name || host.email,
        metadata: { host_id: host.id },
      });
      customerId = customer.id;
      host.stripe_customer_id = customerId;
      await host.save();
    }

    // Resolve active price ID
    const plan = await PlanConfig.findOne();
    const priceId = plan?.stripe_price_id || process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(400).json({ error: 'No Stripe price configured. Add STRIPE_PRICE_ID to env or configure from Admin panel.' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${clientUrl}/?subscribed=1`,
      cancel_url: `${clientUrl}/subscribe`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal — Stripe customer portal
router.post('/portal', auth, async (req, res) => {
  try {
    const stripe = getStripe();
    const host = await Host.findById(req.hostId);
    if (!host.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: host.stripe_customer_id,
      return_url: `${clientUrl}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/webhook — Stripe webhook (raw body, mounted before json middleware)
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.customer) {
          const host = await Host.findOne({ stripe_customer_id: session.customer });
          if (host && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            host.stripe_subscription_id = sub.id;
            host.subscription_status = sub.status;
            host.subscription_current_period_end = new Date(sub.current_period_end * 1000);
            await host.save();
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const host = await Host.findOne({ stripe_customer_id: sub.customer });
        if (host) {
          host.stripe_subscription_id = sub.id;
          host.subscription_status = sub.status;
          host.subscription_current_period_end = new Date(sub.current_period_end * 1000);
          await host.save();
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const host = await Host.findOne({ stripe_customer_id: sub.customer });
        if (host) {
          host.subscription_status = 'canceled';
          host.subscription_current_period_end = sub.current_period_end
            ? new Date(sub.current_period_end * 1000) : null;
          await host.save();
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const host = await Host.findOne({ stripe_customer_id: invoice.customer });
        if (host) {
          host.subscription_status = 'past_due';
          await host.save();
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
