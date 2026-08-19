export type TrustBadgeLevel = 'reliable' | 'caution' | 'risky';

export interface TrustBadge {
  level: TrustBadgeLevel;
  emoji: string;
  label: string;
  /** MUI palette key for Chip color */
  chipColor: 'success' | 'warning' | 'error';
  /** Theme path for colored dots */
  dotColor: string;
  /** Soft background for profile cards */
  bgColor: string;
}

/**
 * Visual Trust Badge thresholds:
 * 🟢 Pouzdan igrač — score > 90
 * 🟡 Zna da otkaže — 70–90
 * 🔴 Rizičan — < 70
 */
export function getTrustBadge(score?: number | null): TrustBadge {
  const value = score ?? 100;

  if (value > 90) {
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

export function formatTrustBadgeLabel(score?: number | null): string {
  const badge = getTrustBadge(score);
  return `${badge.emoji} ${badge.label}`;
}
