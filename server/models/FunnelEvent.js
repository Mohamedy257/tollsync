const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  event: { type: String, required: true, index: true }, // 'register_start' | 'register_submit'
  email: { type: String, default: null },
  ip: { type: String, default: null },
  user_agent: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('FunnelEvent', schema);
