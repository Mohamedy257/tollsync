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
  const { name, plate, transponder_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const existing = await Vehicle.findOne({
    host_id: req.hostId,
    name: { $regex: new RegExp(`^${name}$`, 'i') },
  });
  if (existing) return res.status(200).json({ vehicle: existing });
  const vehicle = await Vehicle.create({
    host_id: req.hostId,
    name,
    plate: plate ? plate.toUpperCase() : '',
    transponder_id: transponder_id ? transponder_id.replace(/\s/g, '') : '',
  });
  res.status(201).json({ vehicle });
});

// PUT /api/vehicles/:id
router.put('/:id', async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, host_id: req.hostId });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const { name, plate, transponder_id } = req.body;
  if (name) vehicle.name = name;
  if (plate) vehicle.plate = plate.toUpperCase();
  if (transponder_id !== undefined) vehicle.transponder_id = transponder_id.replace(/\s/g, '');
  await vehicle.save();
  res.json({ vehicle });
});

// DELETE /api/vehicles/:id
router.delete('/:id', async (req, res) => {
  await Vehicle.deleteOne({ _id: req.params.id, host_id: req.hostId });
  res.json({ success: true });
});

module.exports = router;
