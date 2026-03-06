const express = require('express');
const Match = require('../models/Match');
const Field = require('../models/Field');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { calculateDistance } = require('../utils/notifications');
const { sendPushNotifications } = require('../utils/pushNotifications');

// Helper function to notify nearby players about a new match
async function notifyNearbyPlayers(match, field) {
  try {
    // Build query for players with PWA push subscriptions
    const playersQuery = {
      role: 'player',
      notificationEnabled: true,
      'lastKnownLocation.lat': { $exists: true, $ne: null },
      'lastKnownLocation.lng': { $exists: true, $ne: null },
      'pushSubscription': { $exists: true, $ne: null }
    };

    // Get all players with notifications enabled and valid location
    const players = await User.find(playersQuery);

    console.log(`[Push Notifications] Found ${players.length} players with notifications enabled`);

    if (players.length === 0) {
      console.log('[Push Notifications] No players to notify - check if players have notifications enabled and are subscribed');
      return;
    }

    const fieldLat = field.lat;
    const fieldLng = field.lng;
    const nearbyPlayers = [];

    // Filter players by distance
    for (const player of players) {
      // Skip if player is the creator
      if (player._id.toString() === match.createdBy.toString()) {
        continue;
      }

      const playerLat = player.lastKnownLocation.lat;
      const playerLng = player.lastKnownLocation.lng;
      const radius = player.notificationRadius || 10; // Default 10km

      const distance = calculateDistance(fieldLat, fieldLng, playerLat, playerLng);

      if (distance <= radius && player.pushSubscription) {
        nearbyPlayers.push(player);
      }
    }

    console.log(`[Push Notifications] Found ${nearbyPlayers.length} nearby players within radius`);

    if (nearbyPlayers.length === 0) {
      console.log('[Push Notifications] No nearby players to notify - players are outside notification radius');
      return;
    }

    // Format match date for notification
    const matchDate = new Date(match.dateTime);
    const dateStr = matchDate.toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare notification payload
    const payload = {
      title: 'Novi meč u blizini! ⚽',
      body: `${field.name} - ${dateStr}`,
      url: `/matches/${match._id}`,
      matchId: match._id.toString(),
      image: '/icons/icon-192.png'
    };

    // Build subscriptions array
    const subscriptions = nearbyPlayers
      .filter(player => player.pushSubscription && player.pushSubscription.endpoint)
      .map(player => player.pushSubscription);

    console.log(`[Push Notifications] Prepared ${subscriptions.length} subscriptions to send`);

    if (subscriptions.length === 0) {
      console.log('[Push Notifications] No valid subscriptions to send notifications to');
      return;
    }

    // Send notifications
    console.log(`[Push Notifications] Sending notifications to ${subscriptions.length} subscriptions...`);
    const result = await sendPushNotifications(subscriptions, payload);

    // Remove expired subscriptions
    if (result.expiredSubscriptions && result.expiredSubscriptions.length > 0) {
      for (const expiredSub of result.expiredSubscriptions) {
        if (expiredSub.endpoint) {
          await User.updateMany(
            { 'pushSubscription.endpoint': expiredSub.endpoint },
            { $unset: { pushSubscription: 1 } }
          );
        }
      }
    }

    console.log(`✅ Sent ${result.success} push notifications, ${result.failed} failed`);
  } catch (error) {
    console.error('Error notifying nearby players:', error);
    throw error;
  }
}

function matchesRoutesFactory(io) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    // Check for failed matches before returning
    const now = new Date();
    // Update failed matches - use minPlayers if available, otherwise playersNeeded
    await Match.updateMany(
      {
        status: { $in: ['open', 'full'] },
        registrationDeadline: { $lt: now },
        $expr: {
          $or: [
            { $lt: [{ $size: '$players' }, { $ifNull: ['$minPlayers', '$playersNeeded'] }] }
          ]
        }
      },
      { status: 'failed' }
    );
    
    // Build query - if user is authenticated, exclude matches from creators who blocked them
    let query = {};
    const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find users who have blocked the current user
        const usersWhoBlockedCurrentUser = await User.find({
          blockedPlayers: { $in: [decoded.userId || decoded.id] }
        }).select('_id');
        
        const blockedByIds = usersWhoBlockedCurrentUser.map(u => u._id.toString());
        
        // Exclude matches created by users who blocked the current user
        if (blockedByIds.length > 0) {
          query = {
            createdBy: { $nin: blockedByIds }
          };
        }
      } catch (err) {
        // Invalid token, proceed without filtering
        console.log('Invalid token in matches GET, proceeding without blocked filter');
      }
    }
    
    const matches = await Match.find(query)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .populate('playerCancellations.playerId', 'name')
      .sort({ dateTime: 1 });
    
    // Filter out matches with null or invalid fieldId
    const validMatches = matches.filter(match => match.fieldId && match.fieldId.lat && match.fieldId.lng);
    
    res.json(validMatches);
  });

  router.post('/', auth(true), async (req, res) => {
    try {
      const { sport, fieldId, dateTime, minPlayers, maxPlayers, playersNeeded } = req.body;
      
      // Support both old (playersNeeded) and new (minPlayers) format for backward compatibility
      const minPlayersValue = minPlayers !== undefined ? minPlayers : playersNeeded;
      
      if (!sport || !fieldId || !dateTime || minPlayersValue === undefined) {
        return res.status(400).json({ message: 'Nedostaju polja' });
      }
      
      // Validate minPlayers
      if (typeof minPlayersValue !== 'number' || minPlayersValue < 1) {
        return res.status(400).json({ message: 'Minimalni broj igrača mora biti najmanje 1' });
      }
      
      // Validate maxPlayers if provided
      if (maxPlayers !== undefined) {
        if (typeof maxPlayers !== 'number' || maxPlayers < 1) {
          return res.status(400).json({ message: 'Maksimalni broj igrača mora biti najmanje 1' });
        }
        if (maxPlayers < minPlayersValue) {
          return res.status(400).json({ message: 'Maksimalni broj igrača mora biti veći ili jednak minimalnom broju igrača' });
        }
      }
      
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
      } else {
        matchDate = new Date(dateTime);
      }
      
      // Round match time to full hour (set minutes, seconds, milliseconds to 0)
      matchDate.setMinutes(0);
      matchDate.setSeconds(0);
      matchDate.setMilliseconds(0);
      
      const field = await Field.findById(fieldId);
      if (!field) return res.status(404).json({ message: 'Teren nije pronađen' });
      
      // Validate that match date is in the future
      const now = new Date();
      if (matchDate <= now) {
        return res.status(400).json({ message: 'Meč mora biti u budućnosti. Molimo izaberite kasniji termin meča.' });
      }
      
      // Calculate registration deadline based on field's registrationDeadlineHours
      // Use ?? instead of || to allow 0 as a valid value
      const deadlineHours = field.registrationDeadlineHours ?? 24;
      const deadlineDate = new Date(matchDate);
      deadlineDate.setHours(deadlineDate.getHours() - deadlineHours);
      
      // Validate that deadline is in the future (with 1 minute buffer to account for timezone/precision issues)
      const oneMinuteInMs = 60 * 1000;
      // Only reject if deadline is more than 1 minute in the past (to account for timezone/precision issues)
      if (deadlineDate.getTime() < now.getTime() - oneMinuteInMs) {
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
        minPlayers: minPlayersValue,
        maxPlayers: maxPlayers || undefined,
        playersNeeded: minPlayersValue, // Set to minPlayers for backward compatibility
        players: [req.user.id],
        createdBy: req.user.id,
        status: 'open',
        courtApproval
      });
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', 'name')
        .populate('createdBy', 'name')
        .populate('playerCancellations.playerId', 'name');
      
      // Send push notifications to nearby players
      try {
        await notifyNearbyPlayers(match, field);
      } catch (error) {
        console.error('Error sending push notifications:', error);
        // Don't fail match creation if notifications fail
      }
      
      res.status(201).json(populated);
    } catch (e) {
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  router.get('/:id', async (req, res) => {
    const match = await Match.findById(req.params.id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .populate('playerCancellations.playerId', 'name');
    if (!match) return res.status(404).json({ message: 'Nije pronađeno' });
    if (!match.fieldId || !match.fieldId.lat || !match.fieldId.lng) {
      return res.status(404).json({ message: 'Teren meča je nevažeći ili nedostaje' });
    }
    res.json(match);
  });

  router.post('/:id/join', auth(true), async (req, res) => {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Not found' });
    
    // Check if user has role 'court' - courts cannot join matches
    const user = await User.findById(req.user.id);
    if (user && user.role === 'court') {
      return res.status(403).json({ message: 'Tereni ne mogu da se pridruže meču' });
    }

    // Check if the current user is blocked by the match creator
    const creator = await User.findById(match.createdBy);
    if (creator && creator.blockedPlayers && creator.blockedPlayers.includes(req.user.id)) {
      return res.status(403).json({ message: 'Organizator meča vam je zabranio pristup' });
    }
    
    // Check if registration deadline has passed
    if (new Date() > match.registrationDeadline) {
      return res.status(400).json({ message: 'Rok za prijavu je istekao' });
    }
    
    // Check if match has failed
    if (match.status === 'failed') {
      return res.status(400).json({ message: `Ne možete se pridružiti meču sa statusom: ${match.status}` });
    }

    // Check if match has reached maxPlayers (if set), otherwise allow up to a reasonable limit
    const maxPlayersValue = match.maxPlayers || 100; // Default max if not set
    if (match.players.length >= maxPlayersValue) {
      return res.status(400).json({ message: 'Meč je pun - dostignut je maksimalni broj igrača' });
    }
    
    const already = match.players.some((p) => p.toString() === req.user.id);
    if (!already) {
      match.players.push(req.user.id);
      
      // If player had cancelled before, remove the cancellation record
      if (match.playerCancellations && match.playerCancellations.length > 0) {
        match.playerCancellations = match.playerCancellations.filter(
          c => c.playerId.toString() !== req.user.id.toString()
        );
      }
    }
    // Check if minimum players requirement is met - reserve the slot when minPlayers is reached
    const minPlayersValue = match.minPlayers || match.playersNeeded || 1;
    if (match.players.length >= minPlayersValue) {
      match.status = 'full';
      // Automatski postavi courtApproval na 'approved' (rezervisano) kada je dostignut minPlayers
      if (match.courtApproval === 'pending') {
        match.courtApproval = 'approved';
        match.courtApprovedAt = new Date();
      }
    }
    await match.save();
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .populate('playerCancellations.playerId', 'name');

    // Check if populated match has valid fieldId
    if (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng) {
      return res.status(500).json({ message: 'Teren meča je nevažeći' });
    }

    io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    res.json(populated);
  });

  router.post('/:id/leave', auth(true), async (req, res) => {
    try {
      const match = await Match.findById(req.params.id);
      if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
      
      // Check if user is registered in the match
      const playerIndex = match.players.findIndex((p) => p.toString() === req.user.id);
      if (playerIndex === -1) {
        return res.status(400).json({ message: 'Niste prijavljeni na ovaj meč' });
      }

      // Don't allow leaving if you're the creator and match is full/completed
      if (match.createdBy.toString() === req.user.id && (match.status === 'full' || match.status === 'completed')) {
        return res.status(400).json({ message: 'Ne možete napustiti meč koji ste kreirali i koji je već rezervisan' });
      }

      // Remove player from match
      match.players.splice(playerIndex, 1);

      // Check if player count dropped below minPlayers - unreserve the slot
      const minPlayersValue = match.minPlayers || match.playersNeeded || 1;
      if (match.players.length < minPlayersValue) {
        match.status = 'open';
        // Return courtApproval to 'pending' since minimum requirement is no longer met
        if (match.courtApproval === 'approved') {
          match.courtApproval = 'pending';
          match.courtApprovedAt = undefined;
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
    } catch (e) {
      console.error('Leave match error:', e);
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  // Cancel attendance with comment
  router.post('/:id/cancel-attendance', auth(true), async (req, res) => {
    try {
      const match = await Match.findById(req.params.id);
      if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
      
      // Check if user is registered in the match
      const playerIndex = match.players.findIndex((p) => p.toString() === req.user.id);
      if (playerIndex === -1) {
        return res.status(400).json({ message: 'Niste prijavljeni na ovaj meč' });
      }

      // Don't allow cancelling if you're the creator and match is full/completed
      if (match.createdBy.toString() === req.user.id && (match.status === 'full' || match.status === 'completed')) {
        return res.status(400).json({ message: 'Ne možete otkazati dolazak na meč koji ste kreirali i koji je već rezervisan' });
      }

      const { comment } = req.body;

      // Add cancellation record
      if (!match.playerCancellations) {
        match.playerCancellations = [];
      }
      match.playerCancellations.push({
        playerId: req.user.id,
        comment: comment || '',
        cancelledAt: new Date()
      });

      // Remove player from match
      match.players.splice(playerIndex, 1);

      // Check if player count dropped below minPlayers - unreserve the slot
      const minPlayersValue = match.minPlayers || match.playersNeeded || 1;
      if (match.players.length < minPlayersValue) {
        match.status = 'open';
        // Return courtApproval to 'pending' since minimum requirement is no longer met
        if (match.courtApproval === 'approved') {
          match.courtApproval = 'pending';
          match.courtApprovedAt = undefined;
        }
      }

      await match.save();
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', 'name')
        .populate('createdBy', 'name')
        .populate('playerCancellations.playerId', 'name');

      // Check if populated match has valid fieldId
      if (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng) {
        return res.status(500).json({ message: 'Teren meča je nevažeći' });
      }

      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
      res.json(populated);
    } catch (e) {
      console.error('Cancel attendance error:', e);
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  return router;
}

module.exports = matchesRoutesFactory;


