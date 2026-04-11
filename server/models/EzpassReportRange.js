const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', unique: true, required: true },
  from: { type: String, default: null },
  to: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('EzpassReportRange', schema);
