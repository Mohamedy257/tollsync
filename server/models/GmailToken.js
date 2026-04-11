const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', unique: true, required: true },
  tokens: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
module.exports = mongoose.model('GmailToken', schema);
