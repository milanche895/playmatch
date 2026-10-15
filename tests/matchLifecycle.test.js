const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyFullStatus,
  applyOpenStatusIfBelowMin,
  shouldSendTeamReady,
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

  const first = applyFullStatus(match);

  assert.equal(first.becameFull, true);
  assert.equal(match.status, 'full');
  assert.equal(match.courtApproval, 'pending');
  assert.equal(match.courtApprovedAt, undefined);

  const again = applyFullStatus(match);
  assert.equal(again.becameFull, false);
  assert.equal(match.status, 'full');
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

test('open to full is reported once, then again only after the roster drops below the minimum', () => {
  const match = {
    players: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    minPlayers: 10,
    status: 'open',
    courtApproval: 'pending',
    isInformal: false,
    fieldId: 'field-1',
  };

  assert.equal(applyFullStatus(match).becameFull, false);
  assert.equal(match.status, 'open');

  match.players.push('10');
  assert.equal(applyFullStatus(match).becameFull, true);
  assert.equal(match.status, 'full');
  assert.equal(shouldSendTeamReady(match, 'owner-1'), true);

  assert.equal(applyFullStatus(match).becameFull, false);
  assert.equal(shouldSendTeamReady({ ...match, courtApproval: 'approved' }, 'owner-1'), false);

  match.players.pop();
  applyOpenStatusIfBelowMin(match);
  assert.equal(match.status, 'open');

  match.players.push('11');
  assert.equal(applyFullStatus(match).becameFull, true);
  assert.equal(shouldSendTeamReady(match, 'owner-1'), true);
});

test('waitlist refill after falling below the minimum is a new open-to-full transition', () => {
  const match = {
    players: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    minPlayers: 10,
    status: 'full',
    courtApproval: 'pending',
    isInformal: false,
    fieldId: 'field-1',
  };

  match.players.pop();
  applyOpenStatusIfBelowMin(match);
  assert.equal(match.status, 'open');

  match.players.push('from-waitlist');
  assert.equal(applyFullStatus(match).becameFull, true);
  assert.equal(shouldSendTeamReady(match, 'owner-1'), true);
});

test('a replacement that never drops below the minimum does not notify again', () => {
  const match = {
    players: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    minPlayers: 10,
    status: 'full',
    courtApproval: 'pending',
    fieldId: 'field-1',
  };

  match.players.pop();
  applyOpenStatusIfBelowMin(match);
  assert.equal(match.status, 'full');
  assert.equal(applyFullStatus(match).becameFull, false);
});

test('team_ready is skipped for informal matches, ownerless fields, and already decided approvals', () => {
  const ready = {
    status: 'full',
    courtApproval: 'pending',
    isInformal: false,
    fieldId: 'field-1',
  };

  assert.equal(shouldSendTeamReady(ready, 'owner-1'), true);
  assert.equal(shouldSendTeamReady({ ...ready, isInformal: true }, 'owner-1'), false);
  assert.equal(shouldSendTeamReady(ready, null), false);
  assert.equal(shouldSendTeamReady(ready, undefined), false);
  assert.equal(shouldSendTeamReady({ ...ready, fieldId: null }, 'owner-1'), false);
  assert.equal(shouldSendTeamReady({ ...ready, courtApproval: 'approved' }, 'owner-1'), false);
  assert.equal(shouldSendTeamReady({ ...ready, courtApproval: 'rejected' }, 'owner-1'), false);
});

test('minPlayers of 1 is full as soon as the organizer is on the roster', () => {
  const match = {
    players: ['organizer'],
    minPlayers: 1,
    status: 'open',
    courtApproval: 'pending',
    isInformal: false,
    fieldId: 'field-1',
  };

  const lifecycle = applyFullStatus(match);
  assert.equal(match.status, 'full');
  assert.equal(lifecycle.becameFull, true);
  assert.equal(shouldSendTeamReady(match, 'owner-1'), true);
  assert.equal(shouldSendTeamReady({ ...match, isInformal: true, fieldId: null, courtApproval: 'approved' }, 'owner-1'), false);
});

test('capacity uses maxPlayers and falls back to 100', () => {
  assert.equal(isMatchAtCapacity({ players: ['a', 'b'], maxPlayers: 2 }), true);
  assert.equal(isMatchAtCapacity({ players: ['a'], maxPlayers: 2 }), false);
  assert.equal(getMinPlayersValue({ playersNeeded: 6 }), 6);
  assert.equal(getMinPlayersValue({}), 1);
});
