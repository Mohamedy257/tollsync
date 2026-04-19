const express = require('express');
const ContactMessage = require('../models/ContactMessage');

const router = express.Router();

// POST /api/contact — public, anyone can submit
router.post('/', async (req, res) => {
  const { name, email, subject, message, host_id } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    await ContactMessage.create({ name, email, subject, message, host_id: host_id || null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
