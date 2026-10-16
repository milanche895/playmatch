const test = require('node:test');
const assert = require('node:assert/strict');
const { formatTeamReadyMessage, formatCourtApprovedMessage, formatSlotReservedMessage, playersWaitingPhrase } = require('../src/lib/teamReadyMessage');

test('team ready copy uses the roster size, weekday, and field name', () => {
  const wednesdayEvening = new Date(2026, 9, 14, 20, 0, 0, 0);
  assert.equal(wednesdayEvening.getDay(), 3);

  assert.equal(
    formatTeamReadyMessage({
      playerCount: 10,
      matchDateTime: wednesdayEvening,
      locationName: 'Balon Arena',
    }),
    '10 igrača čeka tvoju potvrdu za sredu u 20:00 na Balon Arena.'
  );
});

test('confirmed slot tells players when and where', () => {
  const wednesdayEvening = new Date(2026, 9, 14, 20, 0, 0, 0);
  assert.equal(
    formatCourtApprovedMessage({
      matchDateTime: wednesdayEvening,
      locationName: 'Balon Arena',
    }),
    'Termin je potvrđen za sredu u 20:00 na Balon Arena.'
  );
});

test('reserved informal slot tells players when and where to meet', () => {
  const wednesdayEvening = new Date(2026, 9, 14, 20, 0, 0, 0);
  assert.equal(
    formatSlotReservedMessage({
      matchDateTime: wednesdayEvening,
      locationName: 'Školsko igralište',
    }),
    'Vidimo se u sredu u 20:00 na Školsko igralište.'
  );
});

test('player count follows Serbian number agreement', () => {
  assert.equal(playersWaitingPhrase(1), '1 igrač čeka');
  assert.equal(playersWaitingPhrase(2), '2 igrača čekaju');
  assert.equal(playersWaitingPhrase(4), '4 igrača čekaju');
  assert.equal(playersWaitingPhrase(5), '5 igrača čeka');
  assert.equal(playersWaitingPhrase(11), '11 igrača čeka');
  assert.equal(playersWaitingPhrase(21), '21 igrač čeka');
});
