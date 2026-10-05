/**
 * Visual trust badge.
 * 🟢 Pouzdan igrač — score >= 90 (matches the backend badge unlock)
 * 🟡 Zna da otkaže — 70–89
 * 🔴 Rizičan — < 70
 * Missing score is treated as 100 (new players start fully reliable).
 */
function getTrustBadge(score) {
  const value = score ?? 100;

  if (value >= 90) {
    return {
      level: 'reliable',
      emoji: '🟢',
      label: 'Pouzdan igrač',
      chipColor: 'success',
      dotColor: 'success.main',
      bgColor: 'success.light',
    };
  }

  if (value >= 70) {
    return {
      level: 'caution',
      emoji: '🟡',
      label: 'Zna da otkaže',
      chipColor: 'warning',
      dotColor: 'warning.main',
      bgColor: 'warning.light',
    };
  }

  return {
    level: 'risky',
    emoji: '🔴',
    label: 'Rizičan',
    chipColor: 'error',
    dotColor: 'error.main',
    bgColor: 'error.light',
  };
}

module.exports = { getTrustBadge };
