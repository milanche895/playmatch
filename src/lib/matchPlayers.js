function formatPlayersCount(match) {
  const current = match?.players?.length || 0;
  const min = match?.minPlayers ?? match?.playersNeeded;
  const max = match?.maxPlayers;

  if (max) {
    return `${current}/${min}-${max}`;
  }
  return `${current}/${min}`;
}

module.exports = { formatPlayersCount };
