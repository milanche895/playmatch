const express = require('express');
const Field = require('../models/Field');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const fields = await Field.find({}).sort({ createdAt: -1 });
  res.json(fields);
});

// optional: allow adding new fields
router.post('/', auth(true), async (req, res) => {
  try {
    const { name, sport, lat, lng } = req.body;
    if (!name || !sport || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Invalid payload' });
    }
    const field = await Field.create({ name, sport, lat, lng });
    res.status(201).json(field);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


