const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, default: null }, // null for OAuth-only accounts
  name: { type: String, default: null },
  phone: { type: String, default: null },
  setup_complete: { type: Boolean, default: null }, // null = existing user (skip wizard), false = new signup
  // OAuth
  google_id: { type: String, default: null },
  facebook_id: { type: String, default: null },
  oauth_provider: { type: String, default: null }, // 'google' | 'facebook' | null
  // Stripe billing
  stripe_customer_id: { type: String, default: null },
  stripe_subscription_id: { type: String, default: null },
  subscription_status: { type: String, default: 'none' }, // none | active | past_due | canceled | trialing
  subscription_current_period_end: { type: Date, default: null },
  // Free trial (no CC required)
  free_trial_ends_at: { type: Date, default: null },
  free_trial_notified: { type: Boolean, default: false },
  // Email verification
  email_verified: { type: Boolean, default: null }, // null = pre-feature (treat as verified), false = pending, true = verified
  email_verification_token: { type: String, default: null },
  // Password reset
  reset_token: { type: String, default: null },
  reset_token_expires: { type: Date, default: null },
}, { timestamps: true });
module.exports = mongoose.model('Host', schema);
