const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true, index: true },
  transponder_id: { type: String, default: null },
  entry_datetime: { type: String, default: null },
  exit_datetime: { type: String, default: null },
  location: { type: String, default: null },
  amount: { type: Number, required: true },
  source_file: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('TollTransaction', schema);
