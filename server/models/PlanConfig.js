const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, default: 'TollSync Pro' },
  description: { type: String, default: 'Unlimited toll calculations for rental hosts' },
  price_cents: { type: Number, default: 1000 }, // $10.00
  stripe_price_id: { type: String, default: null },
  stripe_product_id: { type: String, default: null },
  trial_days: { type: Number, default: 0 },
  stripe_secret_key: { type: String, default: null },
  stripe_publishable_key: { type: String, default: null },
  stripe_webhook_secret: { type: String, default: null },
  // OAuth providers
  google_oauth_enabled: { type: Boolean, default: false },
  google_client_id: { type: String, default: null },
  google_client_secret: { type: String, default: null },
  facebook_oauth_enabled: { type: Boolean, default: false },
  facebook_app_id: { type: String, default: null },
  facebook_app_secret: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('PlanConfig', schema);
