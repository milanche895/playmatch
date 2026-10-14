import { getTrustBadge as computeTrustBadge } from './trustBadge';

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

/** Mirrors `getReliabilityPenaltyPoints` on the server (src/server/utils/reliability.js). */
export function getCancelPenaltyPoints(hoursBeforeMatch: number): number {
  if (hoursBeforeMatch >= 2) return 0;
  if (hoursBeforeMatch >= 1) return 10;
  return 15;
}

export function getTrustBadge(score?: number | null): TrustBadge {
  return computeTrustBadge(score) as TrustBadge;
}
