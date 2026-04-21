const express = require('express');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Field = require('../models/Field');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { calculateDistance } = require('../utils/notifications');
const { sendPushNotifications } = require('../utils/pushNotifications');

const PLAYER_PUBLIC_FIELDS = 'name ratingAvg reliabilityScore sportSkillLevels';

function getReliabilityPenaltyPoints(hoursBeforeMatch) {
  if (hoursBeforeMatch >= 2) return 0;
  if (hoursBeforeMatch >= 1) return 10;
  return 15;
}

async function recalculateUserRatings(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const stats = await Match.aggregate([
    { $match: { 'ratings.ratedUserId': userObjectId } },
    { $unwind: '$ratings' },
    { $match: { 'ratings.ratedUserId': userObjectId } },
    {
      $group: {
        _id: '$ratings.ratedUserId',
        avgStars: { $avg: '$ratings.stars' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  const result = stats[0] || { avgStars: 0, totalRatings: 0 };
  const rounded = Number(result.avgStars.toFixed(2));

  await User.findByIdAndUpdate(userId, {
    $set: { ratingAvg: rounded, ratingsCount: result.totalRatings }
  });
}

// Helper function to notify nearby players about a new match
async function notifyNearbyPlayers(match, field) {
  try {
    // Resolve coordinates — informal matches use their own location, formal matches use the field
    const fieldLat = match.isInformal ? match.informalLocation?.lat : field?.lat;
    const fieldLng = match.isInformal ? match.informalLocation?.lng : field?.lng;
    const locationName = match.isInformal ? (match.informalLocation?.name || 'Privatni teren') : (field?.name || 'Teren');

    if (fieldLat == null || fieldLng == null) {
      console.log('[Push Notifications] No coordinates available, skipping notifications');
      return;
    }

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
      body: `${locationName} - ${dateStr}`,
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

  router.get('/', auth(false), async (req, res) => {
    // Check for failed matches before returning
    const now = new Date();
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
    if (req.user) {
      const usersWhoBlockedCurrentUser = await User.find({
        blockedPlayers: { $in: [req.user.id] }
      }).select('_id');

      const blockedByIds = usersWhoBlockedCurrentUser.map(u => u._id.toString());
      if (blockedByIds.length > 0) {
        query = { createdBy: { $nin: blockedByIds } };
      }
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = parseInt(req.query.skip) || 0;

    const matches = await Match.find(query)
      .populate('fieldId')
      .populate('players', PLAYER_PUBLIC_FIELDS)
      .populate('createdBy', PLAYER_PUBLIC_FIELDS)
      .populate('playerCancellations.playerId', 'name')
      .sort({ dateTime: 1 })
      .skip(skip)
      .limit(limit);

    // Filter out matches with no usable coordinates
    const validMatches = matches.filter(match => {
      if (match.isInformal) {
        return match.informalLocation?.lat != null && match.informalLocation?.lng != null;
      }
      return match.fieldId && match.fieldId.lat && match.fieldId.lng;
    });

    res.json(validMatches);
  });

  router.post('/', auth(true), async (req, res) => {
    try {
      const { sport, fieldId, dateTime, minPlayers, maxPlayers, playersNeeded, isInformal, informalLocation, informalRegistrationDeadlineHours } = req.body;

      // Support both old (playersNeeded) and new (minPlayers) format for backward compatibility
      const minPlayersValue = minPlayers !== undefined ? minPlayers : playersNeeded;

      if (!sport || !dateTime || minPlayersValue === undefined) {
        return res.status(400).json({ message: 'Nedostaju polja' });
      }

      // Validate based on match type
      if (isInformal) {
        if (!informalLocation || !informalLocation.name?.trim() ||
            informalLocation.lat == null || informalLocation.lng == null) {
          return res.status(400).json({ message: 'Neformalni meč zahteva naziv lokacije i koordinate' });
        }
      } else {
        if (!fieldId) {
          return res.status(400).json({ message: 'Nedostaju polja' });
        }
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

      // Parse dateTime
      let matchDate;
      if (typeof dateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime)) {
        const [datePart, timePart] = dateTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        matchDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else {
        matchDate = new Date(dateTime);
      }

      // Round match time to full hour
      matchDate.setMinutes(0);
      matchDate.setSeconds(0);
      matchDate.setMilliseconds(0);

      const now = new Date();
      if (matchDate <= now) {
        return res.status(400).json({ message: 'Meč mora biti u budućnosti. Molimo izaberite kasniji termin meča.' });
      }

      // Calculate registration deadline
      const deadlineDate = new Date(matchDate);
      const oneMinuteInMs = 60 * 1000;

      let field = null;
      let courtApproval = 'approved';

      if (isInformal) {
        // Informal matches: organizer chooses how long signups are open (hours before match)
        const hours = informalRegistrationDeadlineHours !== undefined && informalRegistrationDeadlineHours !== null
          ? Number(informalRegistrationDeadlineHours)
          : 1;
        if (Number.isNaN(hours) || hours < 1 || hours > 48) {
          return res.status(400).json({ message: 'Rok za prijavu mora biti između 1 i 48 sati' });
        }
        deadlineDate.setHours(deadlineDate.getHours() - hours);
        if (deadlineDate.getTime() < now.getTime() - oneMinuteInMs) {
          return res.status(400).json({ message: 'Rok za prijavu bi bio u prošlosti. Molimo izaberite kasniji termin meča.' });
        }
      } else {
        field = await Field.findById(fieldId);
        if (!field) return res.status(404).json({ message: 'Teren nije pronađen' });

        const deadlineHours = field.registrationDeadlineHours ?? 24;
        deadlineDate.setHours(deadlineDate.getHours() - deadlineHours);

        if (deadlineDate.getTime() < now.getTime() - oneMinuteInMs) {
          return res.status(400).json({ message: 'Rok za prijavu bi bio u prošlosti. Molimo izaberite kasniji termin meča.' });
        }

        // Check for overlapping matches on the same field
        const matchDuration = 60 * 60 * 1000;
        const matchStart = matchDate.getTime();
        const matchEnd = matchStart + matchDuration;

        const potentialMatches = await Match.find({
          fieldId,
          status: { $nin: ['otkazano', 'failed'] },
          $or: [
            { courtApproval: { $ne: 'rejected' } },
            { courtApproval: { $exists: false } }
          ],
          dateTime: {
            $gte: new Date(matchStart - matchDuration),
            $lte: new Date(matchEnd + matchDuration)
          }
        });

        const hasOverlap = potentialMatches.some(existingMatch => {
          const existingDate = new Date(existingMatch.dateTime);
          existingDate.setMinutes(0); existingDate.setSeconds(0); existingDate.setMilliseconds(0);
          const existingStart = existingDate.getTime();
          const existingEnd = existingStart + matchDuration;
          return matchStart < existingEnd && existingStart < matchEnd;
        });

        if (hasOverlap) {
          const overlappingMatch = potentialMatches.find(m => {
            const existingDate = new Date(m.dateTime);
            existingDate.setMinutes(0); existingDate.setSeconds(0); existingDate.setMilliseconds(0);
            const existingStart = existingDate.getTime();
            const existingEnd = existingStart + matchDuration;
            return matchStart < existingEnd && existingStart < matchEnd;
          });
          const overlappingTime = overlappingMatch
            ? (() => {
                const date = new Date(overlappingMatch.dateTime);
                date.setMinutes(0); date.setSeconds(0); date.setMilliseconds(0);
                return date.toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              })()
            : '';
          return res.status(409).json({
            message: `Na ovom terenu već postoji meč u ovom vremenu${overlappingTime ? ` (${overlappingTime})` : ''}. Molimo izaberite drugo vreme.`
          });
        }

        // Court owner must approve if field is managed
        courtApproval = field.courtOwner ? 'pending' : 'approved';
      }

      const matchData = {
        sport,
        dateTime: matchDate,
        registrationDeadline: deadlineDate,
        minPlayers: minPlayersValue,
        maxPlayers: maxPlayers || undefined,
        playersNeeded: minPlayersValue,
        players: [req.user.id],
        createdBy: req.user.id,
        status: 'open',
        courtApproval,
        isInformal: !!isInformal,
      };

      if (isInformal) {
        matchData.informalLocation = {
          name: informalLocation.name.trim(),
          lat: Number(informalLocation.lat),
          lng: Number(informalLocation.lng),
        };
        matchData.informalRegistrationDeadlineHours = (informalRegistrationDeadlineHours !== undefined && informalRegistrationDeadlineHours !== null)
          ? Number(informalRegistrationDeadlineHours)
          : 1;
      } else {
        matchData.fieldId = fieldId;
      }

      const match = await Match.create(matchData);
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', PLAYER_PUBLIC_FIELDS)
        .populate('createdBy', PLAYER_PUBLIC_FIELDS)
        .populate('playerCancellations.playerId', 'name');

      // Send push notifications to nearby players (non-blocking)
      notifyNearbyPlayers(match, field).catch(err =>
        console.error('Error sending push notifications:', err)
      );

      res.status(201).json(populated);
    } catch (e) {
      console.error('Create match error:', e);
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  router.get('/:id', async (req, res) => {
    const match = await Match.findById(req.params.id)
      .populate('fieldId')
      .populate('players', PLAYER_PUBLIC_FIELDS)
      .populate('createdBy', PLAYER_PUBLIC_FIELDS)
      .populate('playerCancellations.playerId', 'name');
    if (!match) return res.status(404).json({ message: 'Nije pronađeno' });
    if (match.isInformal) {
      if (!match.informalLocation || match.informalLocation.lat == null || match.informalLocation.lng == null) {
        return res.status(404).json({ message: 'Lokacija meča je nevažeća ili nedostaje' });
      }
    } else if (!match.fieldId || !match.fieldId.lat || !match.fieldId.lng) {
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
      .populate('players', PLAYER_PUBLIC_FIELDS)
      .populate('createdBy', PLAYER_PUBLIC_FIELDS)
      .populate('playerCancellations.playerId', 'name');

    // Check if populated match has valid location
    if (!populated.isInformal && (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng)) {
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
        // Return courtApproval to 'pending' since minimum requirement is no longer met (formal only)
        if (!match.isInformal && match.courtApproval === 'approved') {
          match.courtApproval = 'pending';
          match.courtApprovedAt = undefined;
        }
      }

      await match.save();
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', 'name')
        .populate('createdBy', 'name');

      // Check if populated match has valid location
      if (!populated.isInformal && (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng)) {
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
      const hoursBeforeMatch = (new Date(match.dateTime).getTime() - Date.now()) / (1000 * 60 * 60);
      const penaltyPoints = getReliabilityPenaltyPoints(hoursBeforeMatch);
      let penalizedReliability = false;
      if (penaltyPoints > 0) {
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { reliabilityScore: -penaltyPoints }
        });
        await User.findByIdAndUpdate(req.user.id, {
          $max: { reliabilityScore: 0 }
        });
        penalizedReliability = true;
      }

      match.playerCancellations.push({
        playerId: req.user.id,
        comment: comment || '',
        cancelledAt: new Date(),
        penalizedReliability
      });

      // Remove player from match
      match.players.splice(playerIndex, 1);

      // Check if player count dropped below minPlayers - unreserve the slot
      const minPlayersValue = match.minPlayers || match.playersNeeded || 1;
      if (match.players.length < minPlayersValue) {
        match.status = 'open';
        if (!match.isInformal && match.courtApproval === 'approved') {
          match.courtApproval = 'pending';
          match.courtApprovedAt = undefined;
        }
      }

      await match.save();
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', PLAYER_PUBLIC_FIELDS)
        .populate('createdBy', PLAYER_PUBLIC_FIELDS)
        .populate('playerCancellations.playerId', 'name');

      // Check if populated match has valid location
      if (!populated.isInformal && (!populated.fieldId || !populated.fieldId.lat || !populated.fieldId.lng)) {
        return res.status(500).json({ message: 'Teren meča je nevažeći' });
      }

      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
      res.json(populated);
    } catch (e) {
      console.error('Cancel attendance error:', e);
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  // Organizer confirms informal match was played, with optional no-show list
  router.post('/:id/complete', auth(true), async (req, res) => {
    try {
      const match = await Match.findById(req.params.id);
      if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
      if (match.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Samo organizator može potvrditi termin' });
      }
      if (!match.isInformal) {
        return res.status(400).json({ message: 'Ova akcija je dostupna samo za privatne mečeve' });
      }
      if (match.status === 'completed') {
        return res.status(400).json({ message: 'Termin je već potvrđen' });
      }
      if (match.status === 'failed' || match.status === 'otkazano') {
        return res.status(400).json({ message: 'Meč je otkazan i ne može biti potvrđen' });
      }
      if (new Date() < new Date(match.dateTime)) {
        return res.status(400).json({ message: 'Ne možete potvrditi termin pre nego što počne meč' });
      }

      const noShowIds = (req.body.noShows || []).map(id => id.toString());

      // Process no-shows: penalize reliability, record cancellation, remove from players
      for (const userId of noShowIds) {
        const isInMatch = match.players.some(p => p.toString() === userId);
        if (!isInMatch) continue;

        if (!match.playerCancellations) match.playerCancellations = [];
        match.playerCancellations.push({
          playerId: userId,
          comment: 'Nije došao na termin',
          cancelledAt: new Date(),
          penalizedReliability: true
        });

        // Penalize reliability (15 points for no-show), floor at 0
        await User.findByIdAndUpdate(userId, { $inc: { reliabilityScore: -15 } });
        await User.findByIdAndUpdate(userId, { $max: { reliabilityScore: 0 } });
      }

      // Remove no-shows from players
      if (noShowIds.length > 0) {
        match.players = match.players.filter(p => !noShowIds.includes(p.toString()));
        match.noShows = noShowIds;
      }

      match.status = 'completed';
      await match.save();

      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', PLAYER_PUBLIC_FIELDS)
        .populate('createdBy', PLAYER_PUBLIC_FIELDS)
        .populate('playerCancellations.playerId', 'name');

      io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
      res.json(populated);
    } catch (e) {
      console.error('Complete match error:', e);
      res.status(500).json({ message: 'Greška servera' });
    }
  });

  // Pending ratings for completed match participants
  router.get('/:id/rating-status', auth(true), async (req, res) => {
    try {
      const match = await Match.findById(req.params.id)
        .populate('players', PLAYER_PUBLIC_FIELDS)
        .populate('createdBy', PLAYER_PUBLIC_FIELDS);
      if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
      if (match.status !== 'completed') {
        return res.json({ shouldPrompt: false, pendingUsers: [] });
      }

      const isParticipant = match.players.some((p) => p._id.toString() === req.user.id.toString());
      if (!isParticipant) {
        return res.status(403).json({ message: 'Samo učesnici mogu oceniti saigrače' });
      }

      const ratedUserIds = (match.ratings || [])
        .filter((r) => r.raterId.toString() === req.user.id.toString())
        .map((r) => r.ratedUserId.toString());

      const pendingUsers = match.players
        .filter((p) => p._id.toString() !== req.user.id.toString())
        .filter((p) => !ratedUserIds.includes(p._id.toString()))
        .map((p) => ({
          _id: p._id,
          name: p.name,
          ratingAvg: p.ratingAvg || 0,
          reliabilityScore: p.reliabilityScore ?? 100
        }));

      return res.json({
        shouldPrompt: pendingUsers.length > 0,
        pendingUsers
      });
    } catch (e) {
      return res.status(500).json({ message: 'Greška servera' });
    }
  });

  // Submit teammate ratings (1-5 stars + fair-play)
  router.post('/:id/rate', auth(true), async (req, res) => {
    try {
      const { ratings } = req.body;
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return res.status(400).json({ message: 'Morate poslati bar jednu ocenu' });
      }

      const match = await Match.findById(req.params.id);
      if (!match) return res.status(404).json({ message: 'Meč nije pronađen' });
      if (match.status !== 'completed') {
        return res.status(400).json({ message: 'Ocene su moguće samo za završene mečeve' });
      }

      const isParticipant = match.players.some((p) => p.toString() === req.user.id.toString());
      if (!isParticipant) {
        return res.status(403).json({ message: 'Samo učesnici mogu oceniti saigrače' });
      }

      const participantIds = match.players.map((p) => p.toString());
      const newRatings = [];
      for (const item of ratings) {
        const ratedUserId = item?.ratedUserId?.toString?.() || '';
        const stars = Number(item?.stars);
        const fairPlay = Boolean(item?.fairPlay);
        const skillLevel = Number(item?.skillLevel);
        if (!ratedUserId || ratedUserId === req.user.id.toString()) continue;
        if (!participantIds.includes(ratedUserId)) continue;
        if (Number.isNaN(stars) || stars < 1 || stars > 5) continue;

        const alreadyExists = (match.ratings || []).some(
          (r) => r.raterId.toString() === req.user.id.toString() && r.ratedUserId.toString() === ratedUserId
        );
        if (alreadyExists) continue;

        newRatings.push({
          raterId: req.user.id,
          ratedUserId,
          stars,
          fairPlay,
          sport: match.sport
        });

        if (!Number.isNaN(skillLevel) && skillLevel >= 1 && skillLevel <= 5) {
          await User.findOneAndUpdate(
            { _id: ratedUserId, 'sportSkillLevels.sport': match.sport },
            { $set: { 'sportSkillLevels.$.skillLevel': skillLevel } }
          );
          await User.findOneAndUpdate(
            { _id: ratedUserId, 'sportSkillLevels.sport': { $ne: match.sport } },
            { $push: { sportSkillLevels: { sport: match.sport, skillLevel } } }
          );
        }
      }

      if (newRatings.length === 0) {
        return res.status(400).json({ message: 'Nema novih validnih ocena za čuvanje' });
      }

      match.ratings = [...(match.ratings || []), ...newRatings];
      await match.save();

      const ratedUserIds = [...new Set(newRatings.map((r) => r.ratedUserId.toString()))];
      await Promise.all(ratedUserIds.map((id) => recalculateUserRatings(id)));

      return res.json({ message: 'Ocene su sačuvane', saved: newRatings.length });
    } catch (e) {
      return res.status(500).json({ message: 'Greška servera' });
    }
  });

  return router;
}

module.exports = matchesRoutesFactory;


