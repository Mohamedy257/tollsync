const express = require('express');
const auth = require('../middleware/auth');
const Vehicle = require('../models/Vehicle');

const router = express.Router();
router.use(auth);

// GET /api/vehicles
router.get('/', async (req, res) => {
  const vehicles = await Vehicle.find({ host_id: req.hostId }).sort({ _id: -1 });
  res.json({ vehicles });
});

// POST /api/vehicles
router.post('/', async (req, res) => {
  const { name, nickname, year, make, model, plate, transponder_id, vin } = req.body;
  const ymmName = name || [year, make, model].filter(Boolean).join(' ') || '';
  if (!ymmName) return res.status(400).json({ error: 'Vehicle name or YMM is required' });
  const vehicle = await Vehicle.create({
    host_id: req.hostId,
    name: ymmName,
    nickname: nickname ? nickname.trim() : '',
    year: year || '', make: make || '', model: model || '',
    plate: plate ? plate.toUpperCase() : '',
    transponder_id: transponder_id ? transponder_id.replace(/\s/g, '') : '',
    vin: vin ? vin.trim().toUpperCase() : '',
  });
  res.status(201).json({ vehicle });
});

// PUT /api/vehicles/:id
router.put('/:id', async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, host_id: req.hostId });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const { name, nickname, year, make, model, plate, transponder_id, vin } = req.body;
  if (name !== undefined) vehicle.name = name;
  if (nickname !== undefined) vehicle.nickname = nickname.trim();
  if (year !== undefined) vehicle.year = year;
  if (make !== undefined) vehicle.make = make;
  if (model !== undefined) vehicle.model = model;
  if (plate) vehicle.plate = plate.toUpperCase();
  if (transponder_id !== undefined) vehicle.transponder_id = transponder_id.replace(/\s/g, '');
  if (vin !== undefined) vehicle.vin = vin.trim().toUpperCase();
  await vehicle.save();
  res.json({ vehicle });
});

// DELETE /api/vehicles/:id
router.delete('/:id', async (req, res) => {
  await Vehicle.deleteOne({ _id: req.params.id, host_id: req.hostId });
  res.json({ success: true });
});

module.exports = router;
