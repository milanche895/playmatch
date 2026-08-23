const express = require('express');
const Field = require('../models/Field');
const auth = require('../middleware/auth');
const { sanitizeGameIds } = require('../constants/games');

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
    const { name, sports, sport, lat, lng, price, registrationDeadlineHours } = req.body;
    
    // Support both 'sports' (array) and 'sport' (single string) for backward compatibility
    const sportsArray = sanitizeGameIds(sports || (sport ? [sport] : []));
    
    if (!name || sportsArray.length === 0 || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Naziv, barem jedna validna igra i lokacija su obavezni' });
    }
    
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    // If user is a court, set them as the owner
    const fieldData = { name, sports: sportsArray, lat, lng };
    if (user && user.role === 'court') {
      fieldData.courtOwner = req.user.id;
      if (typeof price === 'number') {
        fieldData.price = price;
      } else if (user.defaultPrice) {
        fieldData.price = user.defaultPrice;
      }
      if (typeof registrationDeadlineHours === 'number' && registrationDeadlineHours >= 0) {
        fieldData.registrationDeadlineHours = registrationDeadlineHours;
      } else if (typeof user.defaultRegistrationDeadlineHours === 'number' && user.defaultRegistrationDeadlineHours >= 0) {
        fieldData.registrationDeadlineHours = user.defaultRegistrationDeadlineHours;
      } else {
        fieldData.registrationDeadlineHours = 0;
      }
    }
    
    const field = await Field.create(fieldData);
    res.status(201).json(field);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


