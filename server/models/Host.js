const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  name: { type: String, default: null },
  setup_complete: { type: Boolean, default: null }, // null = existing user (skip wizard), false = new signup
}, { timestamps: true });
module.exports = mongoose.model('Host', schema);
