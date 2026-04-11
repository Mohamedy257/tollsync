const express = require('express');
const auth = require('../middleware/auth');
const { store, uid } = require('../db/store');

const router = express.Router();
router.use(auth);

// GET /api/vehicles
router.get('/', (req, res) => {
  const vehicles = store.vehicles
    .filter(v => v.host_id === req.hostId)
    .sort((a, b) => b.id - a.id);
  res.json({ vehicles });
});

// POST /api/vehicles — plate and transponder_id are optional (auto-add from trips)
router.post('/', (req, res) => {
  const { name, plate, transponder_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  // Return existing if same name already registered
  const existing = store.vehicles.find(
    v => v.host_id === req.hostId && v.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return res.status(200).json({ vehicle: existing });
  const vehicle = {
    id: uid(),
    host_id: req.hostId,
    name,
    plate: plate ? plate.toUpperCase() : '',
    transponder_id: transponder_id ? transponder_id.replace(/\s/g, '') : '',
    created_at: new Date().toISOString(),
  };
  store.vehicles.push(vehicle);
  res.status(201).json({ vehicle });
});

// PUT /api/vehicles/:id
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const vehicle = store.vehicles.find(v => v.id === id && v.host_id === req.hostId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const { name, plate, transponder_id } = req.body;
  if (name) vehicle.name = name;
  if (plate) vehicle.plate = plate.toUpperCase();
  if (transponder_id !== undefined) vehicle.transponder_id = transponder_id.replace(/\s/g, '');
  res.json({ vehicle });
});

// DELETE /api/vehicles/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  store.vehicles = store.vehicles.filter(v => !(v.id === id && v.host_id === req.hostId));
  res.json({ success: true });
});

module.exports = router;
