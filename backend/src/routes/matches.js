const express = require('express');
const Match = require('../models/Match');
const Field = require('../models/Field');
const auth = require('../middleware/auth');

function matchesRoutesFactory(io) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    // Check for failed matches before returning
    const now = new Date();
    await Match.updateMany(
      {
        status: { $in: ['open', 'full'] },
        registrationDeadline: { $lt: now },
        $expr: { $lt: [{ $size: '$players' }, '$playersNeeded'] }
      },
      { status: 'failed' }
    );
    
    const matches = await Match.find({})
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    
    // Filter out matches with null or invalid fieldId
    const validMatches = matches.filter(match => match.fieldId && match.fieldId.lat && match.fieldId.lng);
    
    res.json(validMatches);
  });

  router.post('/', auth(true), async (req, res) => {
    try {
      const { sport, fieldId, dateTime, playersNeeded } = req.body;
      if (!sport || !fieldId || !dateTime || !playersNeeded) {
        return res.status(400).json({ message: 'Nedostaju polja' });
      }
      
      const matchDate = new Date(dateTime);
      
      // Round match time to full hour (set minutes, seconds, milliseconds to 0)
      matchDate.setMinutes(0);
      matchDate.setSeconds(0);
      matchDate.setMilliseconds(0);
      
      const field = await Field.findById(fieldId);
      if (!field) return res.status(404).json({ message: 'Teren nije pronađen' });
      
      // Calculate registration deadline based on field's registrationDeadlineHours
      const deadlineHours = field.registrationDeadlineHours || 24;
      const deadlineDate = new Date(matchDate);
      deadlineDate.setHours(deadlineDate.getHours() - deadlineHours);
      
      // Validate that deadline is in the future
      if (deadlineDate <= new Date()) {
        return res.status(400).json({ message: 'Rok za prijavu bi bio u prošlosti. Molimo izaberite kasniji termin meča.' });
      }
      
      // Check for overlapping matches on the same field
      // Assume match duration is 60 minutes (1 hour)
      const matchDuration = 60 * 60 * 1000; // 60 minutes in milliseconds
      const matchStart = matchDate.getTime();
      const matchEnd = matchStart + matchDuration;
      
      // Find existing matches on the same field that overlap with the new match time
      // Check all matches except cancelled (otkazano) and failed ones
      // Include pending matches as they also reserve the field
      const overlappingMatches = await Match.find({
        fieldId,
        status: { $nin: ['otkazano', 'failed'] },
        // Also exclude rejected matches
        $or: [
          { courtApproval: { $ne: 'rejected' } },
          { courtApproval: { $exists: false } }
        ],
        dateTime: {
          $gte: new Date(matchStart - matchDuration), // Check 1 hour before
          $lte: new Date(matchEnd) // Check up to 1 hour after
        }
      });
      
      // Check if any existing match overlaps with the new match time
      const hasOverlap = overlappingMatches.some(existingMatch => {
        const existingStart = new Date(existingMatch.dateTime).getTime();
        const existingEnd = existingStart + matchDuration;
        
        // Check if time ranges overlap
        // Two ranges overlap if: start1 < end2 && start2 < end1
        return matchStart < existingEnd && existingStart < matchEnd;
      });
      
      if (hasOverlap) {
        const overlappingMatch = overlappingMatches.find(m => {
          const existingStart = new Date(m.dateTime).getTime();
          const existingEnd = existingStart + matchDuration;
          return matchStart < existingEnd && existingStart < matchEnd;
        });
        
        const overlappingTime = overlappingMatch 
          ? new Date(overlappingMatch.dateTime).toLocaleString('sr-RS', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';
        
        return res.status(409).json({ 
          message: `Na ovom terenu već postoji meč u ovom vremenu${overlappingTime ? ` (${overlappingTime})` : ''}. Molimo izaberite drugo vreme.` 
        });
      }
      
      // If field has a court owner, require approval. Otherwise, auto-approve.
      const courtApproval = field.courtOwner ? 'pending' : 'approved';
      
      const match = await Match.create({
        sport,
        fieldId,
        dateTime: matchDate,
        registrationDeadline: deadlineDate, // Automatically calculated based on field's registrationDeadlineHours
        playersNeeded,
        players: [req.user.id],
        createdBy: req.user.id,
        status: 'open',
        courtApproval
      });
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', 'name')
        .populate('createdBy', 'name');
      res.status(201).json(populated);
    } catch (e) {
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  router.get('/:id', async (req, res) => {
    const match = await Match.findById(req.params.id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    if (!match) return res.status(404).json({ message: 'Nije pronađeno' });
    if (!match.fieldId || !match.fieldId.lat || !match.fieldId.lng) {
      return res.status(404).json({ message: 'Teren meča je nevažeći ili nedostaje' });
    }
    res.json(match);
  });

  router.post('/:id/join', auth(true), async (req, res) => {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Not found' });
    
    // Check if registration deadline has passed
    if (new Date() > match.registrationDeadline) {
      return res.status(400).json({ message: 'Rok za prijavu je istekao' });
    }
    
    // Check if match is already full or failed
    if (match.status === 'full' || match.status === 'failed') {
      return res.status(400).json({ message: `Ne možete se pridružiti meču sa statusom: ${match.status}` });
    }
    
    const already = match.players.some((p) => p.toString() === req.user.id);
    if (!already) match.players.push(req.user.id);
    if (match.players.length >= match.playersNeeded) match.status = 'full';
    await match.save();
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');

    // Check if populated match has valid fieldId
    if (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng) {
      return res.status(500).json({ message: 'Teren meča je nevažeći' });
    }

    io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    res.json(populated);
  });

  return router;
}

module.exports = matchesRoutesFactory;


