const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true, index: true },
  name: { type: String, required: true },
  plate: { type: String, default: '' },
  transponder_id: { type: String, default: '' },
  auto_added: { type: Boolean, default: false },
  candidates: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
module.exports = mongoose.model('Vehicle', schema);
