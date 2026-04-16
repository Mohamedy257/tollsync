const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, default: 'TollSync Pro' },
  description: { type: String, default: 'Unlimited toll calculations for Turo hosts' },
  price_cents: { type: Number, default: 1000 }, // $10.00
  stripe_price_id: { type: String, default: null },
  stripe_product_id: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('PlanConfig', schema);
