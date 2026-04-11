const express = require('express');
const multer = require('multer');
const fs = require('fs');
const auth = require('../middleware/auth');
const { store, uid } = require('../db/store');
const { parseFileWithAI } = require('../services/ai');

const router = express.Router();
router.use(auth);

const upload = multer({
  dest: 'uploads/trips/',
  limits: { fileSize: 20 * 1024 * 1024 }
});

// GET /api/trips
router.get('/', (req, res) => {
  const trips = store.trips
    .filter(t => t.host_id === req.hostId)
    .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));
  res.json({ trips });
});

// POST /api/trips/upload
router.post('/upload', upload.array('files', 20), async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  const results = [];
  for (const file of files) {
    try {
      const parsed = await parseFileWithAI(file.path, file.mimetype, 'trips');
      const inserted = [];
      for (const trip of parsed) {
        if (!trip.start_datetime || !trip.end_datetime) continue;
        const record = {
          id: uid(),
          host_id: req.hostId,
          renter_name: trip.renter_name,
          vehicle: trip.vehicle,
          start_datetime: trip.start_datetime,
          end_datetime: trip.end_datetime,
          trip_id: trip.trip_id,
          source_file: file.originalname,
        };
        store.trips.push(record);
        inserted.push(record);
      }
      results.push({ file: file.originalname, count: inserted.length, trips: inserted });
    } catch (err) {
      console.error('Trip parse error:', err.message);
      results.push({ file: file.originalname, error: err.message });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }
  res.json({ results });
});

// PATCH /api/trips/:id — update start/end datetime
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const trip = store.trips.find(t => t.id === id && t.host_id === req.hostId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const { start_datetime, end_datetime } = req.body;
  if (start_datetime) trip.start_datetime = start_datetime;
  if (end_datetime) trip.end_datetime = end_datetime;
  res.json({ trip });
});

// DELETE /api/trips/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  store.trips = store.trips.filter(t => !(t.id === id && t.host_id === req.hostId));
  res.json({ success: true });
});

// DELETE /api/trips — clear all
router.delete('/', (req, res) => {
  store.trips = store.trips.filter(t => t.host_id !== req.hostId);
  res.json({ success: true });
});

module.exports = router;
