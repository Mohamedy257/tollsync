const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', unique: true, required: true },
  query: { type: String, default: '' },
  subjectRegex: { type: String, default: '' },
  maxResults: { type: Number, default: 50 },
  afterDate: { type: String, default: '' },
}, { timestamps: true });
module.exports = mongoose.model('GmailConfig', schema);
