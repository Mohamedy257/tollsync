const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Host = require('../models/Host');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const existing = await Host.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const host = await Host.create({ email, password_hash: hash, name: name || null, setup_complete: false });
    const token = jwt.sign({ hostId: host.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, host: { id: host.id, email: host.email, name: host.name, setup_complete: host.setup_complete } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const host = await Host.findOne({ email: email.toLowerCase() });
    if (!host) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, host.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ hostId: host.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, host: { id: host.id, email: host.email, name: host.name, setup_complete: host.setup_complete } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/complete-setup
router.post('/complete-setup', require('../middleware/auth'), async (req, res) => {
  const host = await Host.findByIdAndUpdate(req.hostId, { setup_complete: true }, { new: true });
  res.json({ host: { id: host.id, email: host.email, name: host.name, setup_complete: host.setup_complete } });
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const host = await Host.findById(req.hostId);
  if (!host) return res.status(404).json({ error: 'Host not found' });
  res.json({ host: { id: host.id, email: host.email, name: host.name, setup_complete: host.setup_complete } });
});

module.exports = router;
