const WEEKDAY_ACCUSATIVE = ['nedelju', 'ponedeljak', 'utorak', 'sredu', 'četvrtak', 'petak', 'subotu'];

function playersWaitingPhrase(count) {
  const n = Number(count) || 0;
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return `${n} igrač čeka`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} igrača čekaju`;
  return `${n} igrača čeka`;
}

function formatTeamReadyWhen(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'termin';
  const day = WEEKDAY_ACCUSATIVE[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} u ${hours}:${minutes}`;
}

function formatTeamReadyMessage({ playerCount, matchDateTime, locationName }) {
  const place = locationName || 'terenu';
  return `${playersWaitingPhrase(playerCount)} tvoju potvrdu za ${formatTeamReadyWhen(matchDateTime)} na ${place}.`;
}

function formatCourtApprovedMessage({ matchDateTime, locationName }) {
  const place = locationName || 'terenu';
  return `Termin je potvrđen za ${formatTeamReadyWhen(matchDateTime)} na ${place}.`;
}

module.exports = {
  playersWaitingPhrase,
  formatTeamReadyWhen,
  formatTeamReadyMessage,
  formatCourtApprovedMessage,
};
