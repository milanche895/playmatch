/** Badge catalog shown on player profile (ids match backend gamification.js) */
export const BADGE_CATALOG: Record<
  string,
  { id: string; name: string; description: string; emoji: string }
> = {
  pouzdan_igrac: {
    id: 'pouzdan_igrac',
    name: 'Pouzdan Igrač',
    description: 'Visoka pouzdanost na mečevima',
    emoji: '🟢',
  },
  lokalni_kapiten: {
    id: 'lokalni_kapiten',
    name: 'Lokalni Kapiten',
    description: 'Uspešno organizovan barem jedan meč',
    emoji: '👑',
  },
  fer_plej: {
    id: 'fer_plej',
    name: 'Fer-Plej',
    description: 'Dobio si fer-plej ocenu od saigrača',
    emoji: '🤝',
  },
};

export const XP_PER_LEVEL = 200;
export const DEFAULT_STARTING_CREDITS = 3;

export function getXpProgress(xp = 0) {
  const safeXp = Math.max(0, xp);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const currentLevelXp = safeXp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL;
  const progressPct = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));
  return { level, currentLevelXp, nextLevelXp, progressPct, totalXp: safeXp };
}

export function getCreditsDisplay(credits?: number | null) {
  return typeof credits === 'number' ? credits : DEFAULT_STARTING_CREDITS;
}
