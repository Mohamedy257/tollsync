const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true, index: true },
  renter_name: { type: String, default: null },
  vehicle: { type: String, default: null },
  plate: { type: String, default: '' },
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  start_datetime: { type: String, default: null },
  end_datetime: { type: String, default: null },
  trip_id: { type: String, default: null },
  source_file: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('Trip', schema);
