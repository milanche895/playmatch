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

// Mark match as completed
router.post('/matches/:id/complete', auth(true), requireCourt, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
    
    const field = await Field.findById(match.fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    match.status = 'completed';
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

// Get all appointments for all fields owned by court
router.get('/appointments', auth(true), requireCourt, async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;
    
    // Get all fields owned by this court
    const fields = await Field.find({ courtOwner: req.user.id });
    const fieldIds = fields.map(f => f._id);
    
    if (fieldIds.length === 0) {
      return res.json({
        reserved: [],
        pending: [],
        free: [],
        fields: []
      });
    }
    
    // Get today's date range (start and end of today) - for pending and free slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Get all matches for today (for pending and free slots)
    const todayMatches = await Match.find({
      fieldId: { $in: fieldIds },
      dateTime: { $gte: today, $lte: todayEnd }
    })
      .populate('fieldId', 'name sport')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Rezervisani termini: svi full termini koji su approved i NISU završeni (completed)
    // Uzimamo SVE termine bez obzira na datum - samo oni koji još nisu završeni
    const allReservedMatches = await Match.find({
      fieldId: { $in: fieldIds },
      courtApproval: 'approved',
      status: 'full' // 'full' status znači da termin nije završen (completed)
    })
      .populate('fieldId', 'name sport')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    const reserved = allReservedMatches;
    
    // Termini na čekanju: pending approval (samo za danas)
    const pending = todayMatches.filter(m => 
      m.courtApproval === 'pending' && 
      m.status !== 'otkazano'
    );
    
    // For free slots calculation, we need all matches in a wider range
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    
    // Get all matches for free slots calculation
    const matches = await Match.find({
      fieldId: { $in: fieldIds },
      dateTime: { $gte: start, $lte: end }
    })
      .populate('fieldId', 'name sport')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Calculate free slots - ONLY FOR TODAY
    const free = [];
    const matchDuration = 60 * 60 * 1000; // 60 minutes in milliseconds
    
    // Use already declared today and todayEnd variables from above
    
    // For each field, calculate free slots for today only
    for (const field of fields) {
      const fieldMatches = matches.filter(m => m.fieldId._id.toString() === field._id.toString());
      
      // Get working hours for this field (or use default from court)
      const workingHours = field.workingHours || {};
      const court = await User.findById(req.user.id);
      const defaultWorkingHours = court?.workingHours || {};
      
      // Get today's day name
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
      const dayHours = workingHours[dayName] || defaultWorkingHours[dayName] || { start: '09:00', end: '22:00', closed: false };
      
      if (!dayHours.closed && dayHours.start && dayHours.end) {
        // Parse start and end times
        const [startHour, startMin] = dayHours.start.split(':').map(Number);
        const [endHour, endMin] = dayHours.end.split(':').map(Number);
        
        const dayStart = new Date(today);
        dayStart.setHours(startHour, startMin, 0, 0);
        
        const dayEnd = new Date(today);
        dayEnd.setHours(endHour, endMin, 0, 0);
        
        // Generate hourly slots for today only
        let slotTime = new Date(dayStart);
        while (slotTime < dayEnd) {
          const slotEnd = new Date(slotTime.getTime() + matchDuration);
          
          // Check if this slot overlaps with any existing match
          // Exclude cancelled/rejected matches (they become free again)
          // Exclude pending matches (they are in pending tab, not free)
          const hasOverlap = fieldMatches.some(match => {
            // Skip cancelled or rejected matches - they become free again
            if (match.status === 'otkazano' || match.courtApproval === 'rejected') {
              return false;
            }
            
            const matchStart = new Date(match.dateTime).getTime();
            const matchEnd = matchStart + matchDuration;
            const slotStartTime = slotTime.getTime();
            const slotEndTime = slotEnd.getTime();
            
            // Check if time ranges overlap
            return slotStartTime < matchEnd && matchStart < slotEndTime;
          });
          
          // Only add if slot is in the future (or today) and doesn't overlap
          if (slotTime >= new Date() && !hasOverlap) {
            free.push({
              fieldId: {
                _id: field._id,
                name: field.name,
                sport: field.sport
              },
              dateTime: slotTime.toISOString(),
              available: true
            });
          }
          
          slotTime = new Date(slotTime.getTime() + matchDuration);
        }
      }
    }
    
    // Calculate weekly statistics
    // Get start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Calculate days to subtract to get to Monday (1 = Monday, 0 = Sunday)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    // Get end of current week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Get all matches for this week
    const weekMatches = await Match.find({
      fieldId: { $in: fieldIds },
      dateTime: { $gte: weekStart, $lte: weekEnd }
    })
      .populate('fieldId', 'name sport price')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Filter completed matches (exclude cancelled/rejected)
    const completedMatches = weekMatches.filter(m => 
      m.status === 'completed' && 
      m.courtApproval === 'approved' &&
      m.status !== 'otkazano'
    );
    
    // Filter paid matches (for now, use completed as paid - TODO: Add paid field to Match model)
    const paidMatches = weekMatches.filter(m => 
      m.status === 'completed' && 
      m.courtApproval === 'approved' &&
      m.status !== 'otkazano'
      // When paid field is added: && m.paid === true
    );
    
    // Filter cancelled/not held matches for this week
    const cancelledMatches = weekMatches.filter(m => 
      m.status === 'otkazano' || m.courtApproval === 'rejected'
    );
    
    // Calculate total revenue for paid/completed matches
    let totalRevenue = 0;
    paidMatches.forEach(match => {
      const field = match.fieldId;
      const price = field.price || 0;
      totalRevenue += price;
    });
    
    // Calculate total revenue for all completed matches (for the completed tab)
    let completedTotalRevenue = 0;
    completedMatches.forEach(match => {
      const field = match.fieldId;
      const price = field.price || 0;
      completedTotalRevenue += price;
    });
    
    // Calculate monthly statistics
    // Default to current month if not specified
    const selectedMonth = month ? parseInt(month) : now.getMonth() + 1; // 1-12
    const selectedYear = year ? parseInt(year) : now.getFullYear();
    
    // Get start and end of selected month
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(selectedYear, selectedMonth, 0); // Last day of month
    monthEnd.setHours(23, 59, 59, 999);
    
    // Get all matches for selected month
    const monthMatches = await Match.find({
      fieldId: { $in: fieldIds },
      dateTime: { $gte: monthStart, $lte: monthEnd }
    })
      .populate('fieldId', 'name sport price')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Filter completed matches for the month
    const monthlyCompletedMatches = monthMatches.filter(m => 
      m.status === 'completed' && 
      m.courtApproval === 'approved' &&
      m.status !== 'otkazano'
    );
    
    // Filter paid matches for the month
    const monthlyPaidMatches = monthMatches.filter(m => 
      m.status === 'completed' && 
      m.courtApproval === 'approved' &&
      m.status !== 'otkazano'
    );
    
    // Calculate total revenue for monthly paid matches
    let monthlyTotalRevenue = 0;
    monthlyPaidMatches.forEach(match => {
      const field = match.fieldId;
      const price = field.price || 0;
      monthlyTotalRevenue += price;
    });
    
    res.json({
      reserved,
      pending,
      free,
      weekly: {
        matches: weekMatches,
        stats: {
          completed: completedMatches.length,
          paid: paidMatches.length,
          totalRevenue: totalRevenue
        }
      },
      monthly: {
        matches: monthMatches,
        stats: {
          completed: monthlyCompletedMatches.length,
          paid: monthlyPaidMatches.length,
          totalRevenue: monthlyTotalRevenue
        },
        month: selectedMonth,
        year: selectedYear
      },
      completed: completedMatches,
      completedStats: {
        total: completedMatches.length,
        paid: paidMatches.length,
        totalRevenue: completedTotalRevenue
      },
      cancelled: cancelledMatches,
      fields: fields.map(f => ({ _id: f._id, name: f.name, sport: f.sport }))
    });
  } catch (e) {
    console.error('Error fetching appointments:', e);
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
        let start = dayData.start || '16';
        let end = dayData.end || '23';
        
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

// Reserve a free slot (create a match with status 'full' and courtApproval 'approved')
router.post('/appointments/reserve', auth(true), requireCourt, async (req, res) => {
  try {
    const { fieldId, dateTime, description } = req.body;
    
    if (!fieldId || !dateTime) {
      return res.status(400).json({ message: 'Nedostaju fieldId ili dateTime' });
    }
    
    // Check if field belongs to this court
    const field = await Field.findById(fieldId);
    if (!field || field.courtOwner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Ne posedujete ovaj teren' });
    }
    
    const matchDate = new Date(dateTime);
    // Round to full hour
    matchDate.setMinutes(0);
    matchDate.setSeconds(0);
    matchDate.setMilliseconds(0);
    
    // Check if slot is still free (no overlapping matches)
    const matchDuration = 60 * 60 * 1000; // 60 minutes
    const matchStart = matchDate.getTime();
    const matchEnd = matchStart + matchDuration;
    
    const overlappingMatches = await Match.find({
      fieldId,
      status: { $nin: ['otkazano', 'failed'] },
      $or: [
        { courtApproval: { $ne: 'rejected' } },
        { courtApproval: { $exists: false } }
      ],
      dateTime: {
        $gte: new Date(matchStart - matchDuration),
        $lte: new Date(matchEnd)
      }
    });
    
    const hasOverlap = overlappingMatches.some(existingMatch => {
      const existingStart = new Date(existingMatch.dateTime).getTime();
      const existingEnd = existingStart + matchDuration;
      return matchStart < existingEnd && existingStart < matchEnd;
    });
    
    if (hasOverlap) {
      return res.status(409).json({ message: 'Termin je već rezervisan' });
    }
    
    // Calculate registration deadline (set to match time since it's already reserved)
    const deadlineDate = new Date(matchDate);
    deadlineDate.setHours(deadlineDate.getHours() - 1); // 1 hour before match
    
    // Create match with status 'full' and courtApproval 'approved'
    const match = await Match.create({
      sport: field.sport,
      fieldId: field._id,
      dateTime: matchDate,
      registrationDeadline: deadlineDate,
      playersNeeded: 0, // Court reservation doesn't need players
      players: [],
      createdBy: req.user.id,
      status: 'full',
      courtApproval: 'approved',
      courtApprovedBy: req.user.id,
      courtApprovedAt: new Date(),
      description: description || undefined // Opis rezervacije
    });
    
    const populated = await Match.findById(match._id)
      .populate('fieldId', 'name sport')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    
    // Get io from app settings (if available)
    const io = req.app.get('io');
    if (io) {
      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    }
    
    res.status(201).json(populated);
  } catch (e) {
    console.error('Error reserving slot:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

module.exports = router;

