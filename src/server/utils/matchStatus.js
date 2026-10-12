const Match = require('../models/Match');

/**
 * Mark expired open/full matches as failed or otkazano.
 * - failed: registration deadline passed and not enough players
 * - otkazano: deadline passed with court approval still pending
 */
async function processExpiredMatches(io) {
  const now = new Date();
  const matches = await Match.find({
    status: { $in: ['open', 'full'] },
    registrationDeadline: { $lt: now },
  });

  let failedCount = 0;
  let cancelledCount = 0;

  for (const match of matches) {
    const minPlayers = match.minPlayers || match.playersNeeded || 1;
    let newStatus = null;

    if (match.players.length < minPlayers) {
      newStatus = 'failed';
      failedCount++;
    } else if (match.courtApproval === 'pending') {
      newStatus = 'otkazano';
      cancelledCount++;
    }

    if (!newStatus) continue;

    match.status = newStatus;
    await match.save();

    if (io) {
      const populated = await Match.findById(match._id)
        .populate('fieldId', 'name lat lng sports price courtOwner')
        .populate('players', 'name avatarUrl ratingAvg experience')
        .populate('createdBy', 'name avatarUrl');
      io.to(`match:${match._id.toString()}`).emit('match_updated', populated || match);
    }
  }

  return { failedCount, cancelledCount, total: failedCount + cancelledCount };
}

module.exports = { processExpiredMatches };
