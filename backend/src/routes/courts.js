const express = require('express');
const Match = require('../models/Match');
const Field = require('../models/Field');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is a court
async function requireCourt(req, res, next) {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'court') {
    return res.status(403).json({ message: 'Samo tereni mogu pristupiti ovom endpoint-u' });
  }
  req.court = user;
  next();
}

// Get all matches for courts that need approval
router.get('/matches/pending', auth(true), requireCourt, async (req, res) => {
  try {
    // Get all fields owned by this court
    const fields = await Field.find({ courtOwner: req.user.id });
    const fieldIds = fields.map(f => f._id);
    
    // Get pending matches for these fields
    const matches = await Match.find({
      fieldId: { $in: fieldIds },
      courtApproval: 'pending'
    })
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(matches);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Accept a match
router.post('/matches/:id/approve', auth(true), requireCourt, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
    
    const field = await Field.findById(match.fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    match.courtApproval = 'approved';
    match.courtApprovedBy = req.user.id;
    match.courtApprovedAt = new Date();
    await match.save();
    
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    
    const io = req.app.get('io');
    if (io) {
      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    }
    
    res.json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Reject a match
router.post('/matches/:id/reject', auth(true), requireCourt, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
    
    const field = await Field.findById(match.fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    match.courtApproval = 'rejected';
    match.courtApprovedBy = req.user.id;
    match.courtApprovedAt = new Date();
    match.status = 'otkazano';
    await match.save();
    
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    
    const io = req.app.get('io');
    if (io) {
      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    }
    
    res.json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Cancel an appointment (similar to reject but can be used for already approved matches)
router.post('/matches/:id/cancel', auth(true), requireCourt, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
    
    const field = await Field.findById(match.fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    match.status = 'otkazano';
    await match.save();
    
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    
    const io = req.app.get('io');
    if (io) {
      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    }
    
    res.json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update working hours
router.put('/working-hours', auth(true), requireCourt, async (req, res) => {
  try {
    const { workingHours } = req.body;
    if (!workingHours) return res.status(400).json({ message: 'Missing workingHours' });
    
    const user = await User.findById(req.user.id);
    user.workingHours = workingHours;
    await user.save();
    
    res.json({ workingHours: user.workingHours });
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update default price
router.put('/default-price', auth(true), requireCourt, async (req, res) => {
  try {
    const { defaultPrice } = req.body;
    if (typeof defaultPrice !== 'number' || defaultPrice < 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }
    
    const user = await User.findById(req.user.id);
    user.defaultPrice = defaultPrice;
    await user.save();
    
    res.json({ defaultPrice: user.defaultPrice });
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update default registration deadline hours
router.put('/default-deadline', auth(true), requireCourt, async (req, res) => {
  try {
    const { defaultRegistrationDeadlineHours } = req.body;
    if (typeof defaultRegistrationDeadlineHours !== 'number' || defaultRegistrationDeadlineHours < 0) {
      return res.status(400).json({ message: 'Nevažeći sati za rok' });
    }
    
    const user = await User.findById(req.user.id);
    user.defaultRegistrationDeadlineHours = defaultRegistrationDeadlineHours;
    await user.save();
    
    res.json({ defaultRegistrationDeadlineHours: user.defaultRegistrationDeadlineHours });
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get appointments for a field (free, reserved, pending, onRequest)
router.get('/fields/:fieldId/appointments', auth(true), requireCourt, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { startDate, endDate } = req.query;
    
    const field = await Field.findById(fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    
    // Get all matches for this field in the date range
    const matches = await Match.find({
      fieldId,
      dateTime: { $gte: start, $lte: end }
    })
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Get court owner to access working hours
    const court = await User.findById(field.courtOwner);
    
    // Categorize appointments
    const appointments = {
      // Termini na čekanju (pending approval)
      pending: matches.filter(m => m.courtApproval === 'pending' && m.status !== 'otkazano'),
      
      // Rezervisani termini (approved i full/completed)
      reserved: matches.filter(m => 
        m.courtApproval === 'approved' && 
        m.status !== 'otkazano' && 
        m.status !== 'failed' &&
        m.status !== 'open'
      ),
      
      // Termini na upit (open - počelo je brojanje igrača)
      onRequest: matches.filter(m => 
        m.courtApproval === 'approved' && 
        m.status === 'open' &&
        m.players.length < m.playersNeeded
      ),
      
      // Otkazani termini
      cancelled: matches.filter(m => m.status === 'otkazano' || m.courtApproval === 'rejected')
    };
    
    // Calculate free slots based on working hours and existing matches
    // For now, we'll return empty array - this can be enhanced with working hours logic
    appointments.free = [];
    
    res.json(appointments);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get all fields owned by this court
router.get('/fields', auth(true), requireCourt, async (req, res) => {
  try {
    const fields = await Field.find({ courtOwner: req.user.id }).sort({ createdAt: -1 });
    res.json(fields);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update field (name, sport, lat, lng, price, registrationDeadlineHours)
router.put('/fields/:fieldId', auth(true), requireCourt, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { name, sport, lat, lng, price, registrationDeadlineHours } = req.body;
    
    const field = await Field.findById(fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    // Update only provided fields
    if (name !== undefined) field.name = name;
    if (sport !== undefined) field.sport = sport;
    if (typeof lat === 'number') field.lat = lat;
    if (typeof lng === 'number') field.lng = lng;
    if (typeof price === 'number' && price >= 0) field.price = price;
    if (typeof registrationDeadlineHours === 'number' && registrationDeadlineHours >= 0) {
      field.registrationDeadlineHours = registrationDeadlineHours;
    }
    
    await field.save();
    
    res.json(field);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update field working hours
router.put('/fields/:fieldId/working-hours', auth(true), requireCourt, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { workingHours } = req.body;
    
    if (!workingHours) {
      return res.status(400).json({ message: 'Nedostaje radno vreme' });
    }
    
    const field = await Field.findById(fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    // Convert hours to "HH:00" format if they're just numbers
    const formattedWorkingHours = {};
    for (const [day, dayData] of Object.entries(workingHours)) {
      if (dayData && typeof dayData === 'object') {
        let start = dayData.start || '09';
        let end = dayData.end || '22';
        
        // If it's just a number, convert to "HH:00" format
        if (!start.includes(':')) {
          start = `${start.padStart(2, '0')}:00`;
        }
        if (!end.includes(':')) {
          end = `${end.padStart(2, '0')}:00`;
        }
        
        formattedWorkingHours[day] = {
          start,
          end,
          closed: dayData.closed || false
        };
      }
    }
    
    field.workingHours = formattedWorkingHours;
    await field.save();
    
    res.json(field);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update field price (kept for backward compatibility)
router.put('/fields/:fieldId/price', auth(true), requireCourt, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { price } = req.body;
    
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Nevažeća cena' });
    }
    
    const field = await Field.findById(fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    field.price = price;
    await field.save();
    
    res.json(field);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

module.exports = router;

