const express = require('express');
const multer = require('multer');
const fs = require('fs');
const auth = require('../middleware/auth');
const TollTransaction = require('../models/TollTransaction');
const { parseFileWithAI } = require('../services/ai');

const router = express.Router();
router.use(auth);

const upload = multer({
  dest: 'uploads/ezpass/',
  limits: { fileSize: 20 * 1024 * 1024 }
});

// GET /api/ezpass
router.get('/', async (req, res) => {
  const tolls = await TollTransaction.find({ host_id: req.hostId }).sort({ exit_datetime: -1 });
  res.json({ tolls });
});

// POST /api/ezpass/upload
router.post('/upload', upload.array('files', 20), async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  const results = [];
  for (const file of files) {
    try {
      const parsed = await parseFileWithAI(file.path, file.mimetype, 'ezpass');
      const inserted = [];
      for (const toll of parsed) {
        if ((!toll.entry_datetime && !toll.exit_datetime) || !toll.amount) continue;
        const record = await TollTransaction.create({
          host_id: req.hostId,
          transponder_id: toll.transponder_id,
          entry_datetime: toll.entry_datetime || null,
          exit_datetime: toll.exit_datetime || null,
          location: toll.location,
          amount: Math.abs(parseFloat(toll.amount)),
          source_file: file.originalname,
        });
        inserted.push(record);
      }
      results.push({ file: file.originalname, count: inserted.length, tolls: inserted });
    } catch (err) {
      console.error('EZPass parse error:', err.message);
      results.push({ file: file.originalname, error: err.message });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }
  res.json({ results });
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
