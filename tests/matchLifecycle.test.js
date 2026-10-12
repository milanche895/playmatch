const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyFullStatus,
  applyOpenStatusIfBelowMin,
  getMatchAccessBlock,
  getCourtCompleteBlock,
  isMatchAtCapacity,
  getMinPlayersValue,
} = require('../src/server/utils/matchLifecycle');

test('reaching min players marks the match full without auto-approving the court', () => {
  const match = {
    players: ['a', 'b'],
    minPlayers: 2,
    status: 'open',
    courtApproval: 'pending',
    courtApprovedAt: undefined,
  };

  applyFullStatus(match);

  assert.equal(match.status, 'full');
  assert.equal(match.courtApproval, 'pending');
  assert.equal(match.courtApprovedAt, undefined);
});

test('dropping below min reopens the match and keeps an existing court approval', () => {
  const match = {
    players: ['a'],
    minPlayers: 2,
    status: 'full',
    courtApproval: 'approved',
    courtApprovedAt: new Date('2026-01-01'),
    isInformal: false,
  };

  applyOpenStatusIfBelowMin(match);

  assert.equal(match.status, 'open');
  assert.equal(match.courtApproval, 'approved');
});

test('join is blocked for finished, cancelled, rejected, and expired matches', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const past = new Date(Date.now() - 60 * 1000);

  assert.equal(getMatchAccessBlock({ status: 'completed', registrationDeadline: future })?.code, 'closed');
  assert.equal(getMatchAccessBlock({ status: 'otkazano', registrationDeadline: future })?.status, 'otkazano');
  assert.equal(getMatchAccessBlock({ status: 'failed', registrationDeadline: future })?.code, 'closed');
  assert.equal(getMatchAccessBlock({ status: 'open', courtApproval: 'rejected', registrationDeadline: future })?.code, 'rejected');
  assert.equal(getMatchAccessBlock({ status: 'open', courtApproval: 'pending', registrationDeadline: past })?.code, 'deadline');
  assert.equal(getMatchAccessBlock({ status: 'open', courtApproval: 'pending', registrationDeadline: future }), null);
});

test('court cannot complete informal, pending, rejected, cancelled, or future matches', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000);
  const future = new Date(Date.now() + 60 * 60 * 1000);

  assert.equal(getCourtCompleteBlock({ isInformal: true, status: 'full', dateTime: past }), 'informal');
  assert.equal(getCourtCompleteBlock({ status: 'completed', courtApproval: 'approved', dateTime: past }), 'already');
  assert.equal(getCourtCompleteBlock({ status: 'otkazano', courtApproval: 'approved', dateTime: past }), 'cancelled');
  assert.equal(getCourtCompleteBlock({ status: 'full', courtApproval: 'pending', dateTime: past }), 'not_approved');
  assert.equal(getCourtCompleteBlock({ status: 'full', courtApproval: 'rejected', dateTime: past }), 'not_approved');
  assert.equal(getCourtCompleteBlock({ status: 'full', courtApproval: 'approved', dateTime: future }), 'too_early');
  assert.equal(getCourtCompleteBlock({ status: 'full', courtApproval: 'approved', dateTime: past }), null);
});

test('capacity uses maxPlayers and falls back to 100', () => {
  assert.equal(isMatchAtCapacity({ players: ['a', 'b'], maxPlayers: 2 }), true);
  assert.equal(isMatchAtCapacity({ players: ['a'], maxPlayers: 2 }), false);
  assert.equal(getMinPlayersValue({ playersNeeded: 6 }), 6);
  assert.equal(getMinPlayersValue({}), 1);
});
