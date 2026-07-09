const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true, index: true },
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  toll_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TollTransaction' },
  amount: { type: Number, required: true },
  paid: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('TripResult', schema);
