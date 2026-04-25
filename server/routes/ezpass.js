const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const TollTransaction = require('../models/TollTransaction');
const { parseFileWithAI } = require('../services/ai');

const router = express.Router();
router.use(auth);

// Use memory storage so file bytes are available directly as buffer.buffer,
// avoiding any disk I/O issues that can produce empty files.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Treat placeholder values from EZ-Pass files as no location
const PLACEHOLDER = /^[-_\s.]+$|^n\/?a$/i;
function sanitizeLocation(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) return null;
  return trimmed;
}

function resolveMimeType(file) {
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.csv')) return 'text/csv';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return file.mimetype || 'application/octet-stream';
}

// GET /api/ezpass
router.get('/', async (req, res) => {
  try {
    const tolls = await TollTransaction.find({ host_id: req.hostId }).sort({ exit_datetime: -1 });
    res.json({ tolls });
  } catch (err) {
    console.error('EZPass fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load toll records' });
  }
});

// POST /api/ezpass/upload
router.post('/upload', upload.array('files', 20), async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  const results = [];
  for (const file of files) {
    const mimeType = resolveMimeType(file);
    try {
      const parsed = await parseFileWithAI(file.buffer, mimeType, 'ezpass');
      const inserted = [];
      for (const toll of parsed) {
        if ((!toll.entry_datetime && !toll.exit_datetime) || !toll.amount) continue;
        const agency = sanitizeLocation(toll.agency);
        const entryPlaza = sanitizeLocation(toll.entry_plaza);
        const exitPlaza = sanitizeLocation(toll.exit_plaza);
        const plazaFacility = sanitizeLocation(toll.plaza_facility);
        const location = [agency, entryPlaza, exitPlaza, plazaFacility].filter(Boolean).join(' - ') || null;
        const record = await TollTransaction.create({
          host_id: req.hostId,
          transponder_id: toll.transponder_id,
          entry_datetime: toll.entry_datetime || null,
          exit_datetime: toll.exit_datetime || null,
          agency,
          entry_plaza: entryPlaza,
          exit_plaza: exitPlaza,
          plaza_facility: plazaFacility,
          location,
          amount: Math.abs(parseFloat(toll.amount)),
          source_file: file.originalname,
        });
        inserted.push(record);
      }
      results.push({ file: file.originalname, count: inserted.length, tolls: inserted });
    } catch (err) {
      console.error('EZPass parse error:', err.message);
      results.push({ file: file.originalname, error: err.message });
    }
  }
  res.json({ results });
});

// POST /api/ezpass/fix-locations — one-time cleanup: null out placeholder location values
router.post('/fix-locations', async (req, res) => {
  try {
    const result = await TollTransaction.updateMany(
      { host_id: req.hostId, location: { $in: ['_', '-', 'N/A', 'n/a', '', null] } },
      { $set: { location: null } }
    );
    res.json({ fixed: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ezpass/file/:filename — delete all records from a specific source file
router.delete('/file/:filename', async (req, res) => {
  const result = await TollTransaction.deleteMany({
    host_id: req.hostId,
    source_file: req.params.filename,
  });
  res.json({ deleted: result.deletedCount });
});

// DELETE /api/ezpass/:id
router.delete('/:id', async (req, res) => {
  await TollTransaction.deleteOne({ _id: req.params.id, host_id: req.hostId });
  res.json({ success: true });
});

// DELETE /api/ezpass — clear all
router.delete('/', async (req, res) => {
  await TollTransaction.deleteMany({ host_id: req.hostId });
  res.json({ success: true });
});

module.exports = router;
