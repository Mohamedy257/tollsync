const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', default: null }, // null = logged-out user
  read: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('ContactMessage', schema);
