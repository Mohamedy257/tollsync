const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  name: { type: String, default: null },
  setup_complete: { type: Boolean, default: null }, // null = existing user (skip wizard), false = new signup
  // Stripe billing
  stripe_customer_id: { type: String, default: null },
  stripe_subscription_id: { type: String, default: null },
  subscription_status: { type: String, default: 'none' }, // none | active | past_due | canceled | trialing
  subscription_current_period_end: { type: Date, default: null },
}, { timestamps: true });
module.exports = mongoose.model('Host', schema);
