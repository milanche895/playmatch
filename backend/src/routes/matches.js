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
      
      console.log('[CREATE MATCH] Received dateTime:', dateTime, 'Type:', typeof dateTime);
      
      // Parse dateTime - if it's in YYYY-MM-DDTHH:MM format (no timezone), treat as local time
      // Otherwise parse normally
      let matchDate;
      if (typeof dateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime)) {
        // Format: YYYY-MM-DDTHH:MM (no timezone) - treat as local time
        // Extract components and create Date in local timezone
        const [datePart, timePart] = dateTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        matchDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        console.log('[CREATE MATCH] Parsed as local time:', matchDate.toISOString(), 'Local:', matchDate.toString());
      } else {
        matchDate = new Date(dateTime);
        console.log('[CREATE MATCH] Parsed date:', matchDate.toISOString(), 'Local:', matchDate.toString());
      }
      
      // Round match time to full hour (set minutes, seconds, milliseconds to 0)
      matchDate.setMinutes(0);
      matchDate.setSeconds(0);
      matchDate.setMilliseconds(0);
      console.log('[CREATE MATCH] Rounded date:', matchDate.toISOString(), 'Local:', matchDate.toString());
      
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
      
      // Find existing matches on the same field that could potentially overlap
      // We'll check a wider range first, then verify actual overlap
      // Check all matches except cancelled (otkazano) and failed ones
      // Include pending matches as they also reserve the field
      const potentialMatches = await Match.find({
        fieldId,
        status: { $nin: ['otkazano', 'failed'] },
        // Also exclude rejected matches
        $or: [
          { courtApproval: { $ne: 'rejected' } },
          { courtApproval: { $exists: false } }
        ],
        dateTime: {
          $gte: new Date(matchStart - matchDuration), // Check 1 hour before
          $lte: new Date(matchEnd + matchDuration) // Check 1 hour after end
        }
      });
      
      // Check if any existing match actually overlaps with the new match time
      // Two time ranges overlap if they share any common time
      // Range A: [matchStart, matchEnd) where matchEnd = matchStart + 1 hour
      // Range B: [existingStart, existingEnd) where existingEnd = existingStart + 1 hour
      // They overlap if: matchStart < existingEnd && existingStart < matchEnd
      // Note: 20:00-21:00 and 21:00-22:00 should NOT overlap (boundary case)
      const hasOverlap = potentialMatches.some(existingMatch => {
        // Round existing match time to full hour (same as new match)
        const existingDate = new Date(existingMatch.dateTime);
        existingDate.setMinutes(0);
        existingDate.setSeconds(0);
        existingDate.setMilliseconds(0);
        
        const existingStart = existingDate.getTime();
        const existingEnd = existingStart + matchDuration;
        
        // Check if time ranges actually overlap
        // Two ranges overlap if: matchStart < existingEnd && existingStart < matchEnd
        // For non-overlapping: if matchStart >= existingEnd OR existingStart >= matchEnd, they don't overlap
        // For overlapping: matchStart < existingEnd AND existingStart < matchEnd
        const overlaps = matchStart < existingEnd && existingStart < matchEnd;
        
        return overlaps;
      });
      
      if (hasOverlap) {
        const overlappingMatch = potentialMatches.find(m => {
          // Round existing match time to full hour (same as new match)
          const existingDate = new Date(m.dateTime);
          existingDate.setMinutes(0);
          existingDate.setSeconds(0);
          existingDate.setMilliseconds(0);
          
          const existingStart = existingDate.getTime();
          const existingEnd = existingStart + matchDuration;
          return matchStart < existingEnd && existingStart < matchEnd;
        });
        
        const overlappingTime = overlappingMatch 
          ? (() => {
              const date = new Date(overlappingMatch.dateTime);
              date.setMinutes(0);
              date.setSeconds(0);
              date.setMilliseconds(0);
              return date.toLocaleString('sr-RS', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            })()
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
    if (match.players.length >= match.playersNeeded) {
      match.status = 'full';
      // Ako je meč pun, automatski postavi courtApproval na 'approved' (rezervisano) ako je bio 'pending'
      if (match.courtApproval === 'pending') {
        match.courtApproval = 'approved';
        match.courtApprovedAt = new Date();
      }
    }
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


