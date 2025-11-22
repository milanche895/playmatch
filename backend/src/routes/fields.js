const express = require('express');
const Field = require('../models/Field');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const fields = await Field.find({}).sort({ createdAt: -1 });
  res.json(fields);
});

router.get('/:id', async (req, res) => {
  try {
    const field = await Field.findById(req.params.id);
    if (!field) return res.status(404).json({ message: 'Field not found' });
    res.json(field);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth(true), async (req, res) => {
  try {
    const { name, sport, lat, lng, price, registrationDeadlineHours } = req.body;
    if (!name || !sport || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Invalid payload' });
    }
    
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    // If user is a court, set them as the owner
    const fieldData = { name, sport, lat, lng };
    if (user && user.role === 'court') {
      fieldData.courtOwner = req.user.id;
      if (typeof price === 'number') {
        fieldData.price = price;
      } else if (user.defaultPrice) {
        fieldData.price = user.defaultPrice;
      }
      if (typeof registrationDeadlineHours === 'number' && registrationDeadlineHours >= 0) {
        fieldData.registrationDeadlineHours = registrationDeadlineHours;
      } else if (user.defaultRegistrationDeadlineHours) {
        fieldData.registrationDeadlineHours = user.defaultRegistrationDeadlineHours;
      }
    }
    
    const field = await Field.create(fieldData);
    res.status(201).json(field);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


