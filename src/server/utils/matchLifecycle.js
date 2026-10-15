function getMaxPlayersValue(match) {
  return match.maxPlayers || 100;
}

function isMatchAtCapacity(match) {
  return (match.players || []).length >= getMaxPlayersValue(match);
}

function getMinPlayersValue(match) {
  return match.minPlayers || match.playersNeeded || 1;
}

/**
 * Mark the match full once the minimum is reached.
 * Court approval stays whatever the owner (or creation flow) set.
 * @returns {{ becameFull: boolean }} true only on a real open -> full transition
 */
function applyFullStatus(match) {
  const wasFull = match.status === 'full';
  if ((match.players || []).length >= getMinPlayersValue(match)) {
    match.status = 'full';
  }
  return { becameFull: !wasFull && match.status === 'full' };
}

/**
 * Owner "Ekipa je spremna" is only for a formal match that still needs approval
 * on a field that has an owner. `courtOwner` is the loaded owner id, or empty.
 */
function shouldSendTeamReady(match, courtOwner) {
  if (!match || match.isInformal) return false;
  if (match.courtApproval !== 'pending') return false;
  const field = match.fieldId;
  const fieldId = field && field._id ? field._id : field;
  if (!fieldId) return false;
  return Boolean(courtOwner);
}

/**
 * Re-open a match that dropped below the minimum.
 * An existing court approval is kept so players can rejoin without another review.
 */
function applyOpenStatusIfBelowMin(match) {
  if ((match.players || []).length < getMinPlayersValue(match)) {
    match.status = 'open';
  }
}

/**
 * Shared gate for join and waitlist.
 * @returns {{ code: 'closed', status: string } | { code: 'rejected' } | { code: 'deadline' } | null}
 */
function getMatchAccessBlock(match, now = new Date()) {
  if (!match) return { code: 'closed', status: 'missing' };
  if (match.status === 'failed' || match.status === 'otkazano' || match.status === 'completed') {
    return { code: 'closed', status: match.status };
  }
  if (match.courtApproval === 'rejected') return { code: 'rejected' };
  if (match.registrationDeadline && now > new Date(match.registrationDeadline)) {
    return { code: 'deadline' };
  }
  return null;
}

/**
 * Why a court owner cannot mark a formal match completed.
 * @returns {'informal' | 'already' | 'cancelled' | 'not_approved' | 'too_early' | null}
 */
function getCourtCompleteBlock(match, now = new Date()) {
  if (!match) return 'cancelled';
  if (match.isInformal) return 'informal';
  if (match.status === 'completed') return 'already';
  if (match.status === 'failed' || match.status === 'otkazano') return 'cancelled';
  if (match.courtApproval === 'rejected' || match.courtApproval === 'pending') return 'not_approved';
  if (match.dateTime && now < new Date(match.dateTime)) return 'too_early';
  return null;
}

module.exports = {
  getMaxPlayersValue,
  isMatchAtCapacity,
  getMinPlayersValue,
  applyFullStatus,
  shouldSendTeamReady,
  applyOpenStatusIfBelowMin,
  getMatchAccessBlock,
  getCourtCompleteBlock,
};
