const express = require('express');
const auth = require('../middleware/auth');
const Host = require('../models/Host');
const PlanConfig = require('../models/PlanConfig');
const {
  sendSubscriptionWelcome, sendCancellation, sendPaymentFailed,
  sendSubscriptionRenewed, sendTrialEnding,
} = require('../services/email');

const router = express.Router();

async function getStripe() {
  const plan = await PlanConfig.findOne();
  const key = plan?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe secret key not configured. Set it in Admin > Stripe Configuration.');
  return require('stripe')(key);
}

async function getWebhookSecret() {
  const plan = await PlanConfig.findOne();
  return plan?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
}

// GET /api/billing/plan — public plan info
router.get('/plan', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne() || {};
    res.json({
      name: plan.name || 'TollSync Pro',
      description: plan.description || 'Unlimited toll calculations for rental hosts',
      price_cents: plan.price_cents || 1000,
      trial_days: plan.trial_days ?? 0,
      terms_text: plan.terms_text || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/contact — public contact info (WhatsApp, email)
router.get('/contact', async (req, res) => {
  try {
    const plan = await PlanConfig.findOne() || {};
    res.json({
      whatsapp_number: plan.whatsapp_number || '16673598525',
      support_email: plan.support_email || 'mohamedy257@gmail.com',
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
    const { from } = req.body; // 'wizard' = return to wizard after payment
    const stripe = await getStripe();
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
    if (!priceId) return res.status(400).json({ error: 'No Stripe price configured. Set it in Admin > Stripe Configuration.' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const trialDays = plan?.trial_days || 0;
    const taxRateId = plan?.stripe_tax_rate_id || process.env.STRIPE_TAX_RATE_ID || null;

    const sessionParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1, ...(taxRateId ? { tax_rates: [taxRateId] } : {}) }],
      success_url: from === 'wizard'
        ? `${clientUrl}/?session_id={CHECKOUT_SESSION_ID}`
        : `${clientUrl}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: from === 'wizard' ? `${clientUrl}/` : `${clientUrl}/subscribe`,
    };
    if (trialDays > 0) {
      sessionParams.subscription_data = { trial_period_days: trialDays };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/verify-session?session_id=... — verify checkout session and activate subscription
router.get('/verify-session', auth, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.json({ subscription_status: 'none' });
    }

    const host = await Host.findById(req.hostId);
    const sub = session.subscription;
    if (sub) {
      host.stripe_customer_id = session.customer;
      host.stripe_subscription_id = sub.id;
      host.subscription_status = sub.status;
      host.subscription_current_period_end = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      await host.save();
    }

    res.json({ subscription_status: host.subscription_status });
  } catch (err) {
    console.error('Verify session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/sync — pull latest subscription state from Stripe and update DB
router.post('/sync', auth, async (req, res) => {
  try {
    const host = await Host.findById(req.hostId);
    if (!host.stripe_customer_id) return res.json({ subscription_status: host.subscription_status || 'none' });

    const stripe = await getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: host.stripe_customer_id,
      limit: 1,
      status: 'all',
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      host.stripe_subscription_id = sub.id;
      host.subscription_status = sub.status;
      host.subscription_current_period_end = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      await host.save();
    }

    res.json({ subscription_status: host.subscription_status });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal — Stripe customer portal
router.post('/portal', auth, async (req, res) => {
  try {
    const stripe = await getStripe();
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
  const sig = req.headers['stripe-signature'];
  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  const stripe = await getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
            const plan = await PlanConfig.findOne();
            const trialDays = sub.trial_end ? Math.round((sub.trial_end - Date.now() / 1000) / 86400) : 0;
            sendSubscriptionWelcome(
              host.email, host.name,
              plan?.name || 'TollSync Pro',
              plan?.price_cents || 1000,
              host.subscription_current_period_end,
              trialDays > 0 ? trialDays : 0
            ).catch(err => console.error('Welcome email error:', err.message));
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
          const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
          host.subscription_status = 'canceled';
          host.subscription_current_period_end = periodEnd;
          await host.save();
          sendCancellation(host.email, host.name, periodEnd)
            .catch(err => console.error('Cancellation email error:', err.message));
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const host = await Host.findOne({ stripe_customer_id: invoice.customer });
        if (host) {
          host.subscription_status = 'past_due';
          await host.save();
          sendPaymentFailed(host.email, host.name)
            .catch(err => console.error('Payment failed email error:', err.message));
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Only send renewal email on recurring payments, not the first charge
        if (invoice.billing_reason === 'subscription_cycle') {
          const host = await Host.findOne({ stripe_customer_id: invoice.customer });
          if (host) {
            const periodEnd = invoice.lines?.data?.[0]?.period?.end
              ? new Date(invoice.lines.data[0].period.end * 1000) : null;
            sendSubscriptionRenewed(host.email, host.name, periodEnd, invoice.amount_paid)
              .catch(err => console.error('Renewal email error:', err.message));
          }
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const host = await Host.findOne({ stripe_customer_id: sub.customer });
        if (host && sub.trial_end) {
          sendTrialEnding(host.email, host.name, new Date(sub.trial_end * 1000))
            .catch(err => console.error('Trial ending email error:', err.message));
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
