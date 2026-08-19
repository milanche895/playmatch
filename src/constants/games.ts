export const CATEGORIES = {
  SPORT: 'sport',
  TABLETOP: 'tabletop',
  PUB: 'pub',
  ESPORTS: 'esports',
} as const;

export type CategoryId = (typeof CATEGORIES)[keyof typeof CATEGORIES];

export type GameType = {
  id: string;
  name: string;
  category: CategoryId;
  defaultMinPlayers: number;
  defaultMaxPlayers: number;
};

export const CATEGORY_META: Record<
  CategoryId,
  { id: CategoryId; label: string; description: string }
> = {
  sport: {
    id: 'sport',
    label: 'Sport',
    description: 'Fudbal, košarka, tenis, padel…',
  },
  tabletop: {
    id: 'tabletop',
    label: 'Društvene igre',
    description: 'Catan, šah, karte i ostale tabletop igre',
  },
  pub: {
    id: 'pub',
    label: 'Pub igre',
    description: 'Pikado, bilijar, stolni fudbal…',
  },
  esports: {
    id: 'esports',
    label: 'Gaming',
    description: 'E-sport i online igre',
  },
};

function g(
  id: string,
  name: string,
  category: CategoryId,
  defaultMinPlayers: number,
  defaultMaxPlayers: number
): GameType {
  return { id, name, category, defaultMinPlayers, defaultMaxPlayers };
}

export const GAME_TYPES: Record<string, GameType> = {
  // ——— Sport ———
  football: g('football', 'Mali fudbal', 'sport', 10, 12),
  football_11: g('football_11', 'Fudbal 11', 'sport', 16, 22),
  basketball: g('basketball', 'Košarka', 'sport', 6, 10),
  basketball_3x3: g('basketball_3x3', 'Košarka 3x3', 'sport', 4, 6),
  volleyball: g('volleyball', 'Odbojka', 'sport', 8, 12),
  beach_volleyball: g('beach_volleyball', 'Odbojka na pesku', 'sport', 4, 6),
  tennis: g('tennis', 'Tenis', 'sport', 2, 4),
  padel: g('padel', 'Padel', 'sport', 4, 4),
  badminton: g('badminton', 'Badminton', 'sport', 2, 4),
  table_tennis: g('table_tennis', 'Stoni tenis', 'sport', 2, 4),
  handball: g('handball', 'Rukomet', 'sport', 10, 14),
  running: g('running', 'Trčanje', 'sport', 2, 30),
  cycling: g('cycling', 'Biciklizam', 'sport', 2, 20),
  swimming: g('swimming', 'Plivanje', 'sport', 2, 12),
  gym: g('gym', 'Teretana / fitness', 'sport', 2, 10),
  hiking: g('hiking', 'Planinarenje', 'sport', 2, 15),
  skating: g('skating', 'Rolanje / skejt', 'sport', 2, 12),
  martial_arts: g('martial_arts', 'Borilačke veštine', 'sport', 2, 12),
  squash: g('squash', 'Skvoš', 'sport', 2, 2),

  // ——— Društvene igre ———
  board_game_generic: g('board_game_generic', 'Društvene igre (opšte)', 'tabletop', 2, 8),
  catan: g('catan', 'Catan', 'tabletop', 3, 4),
  chess: g('chess', 'Šah', 'tabletop', 2, 2),
  monopoly: g('monopoly', 'Monopol', 'tabletop', 2, 6),
  tickets_to_ride: g('tickets_to_ride', 'Ticket to Ride', 'tabletop', 2, 5),
  carcassonne: g('carcassonne', 'Carcassonne', 'tabletop', 2, 5),
  uno: g('uno', 'UNO', 'tabletop', 2, 10),
  cards_generic: g('cards_generic', 'Karte (preferans, tablić…)', 'tabletop', 2, 6),
  poker: g('poker', 'Poker', 'tabletop', 2, 9),
  wizard: g('wizard', 'Wizard', 'tabletop', 3, 6),
  avalanche: g('avalanche', 'Avalanche', 'tabletop', 2, 6),
  exploding_kittens: g('exploding_kittens', 'Exploding Kittens', 'tabletop', 2, 5),
  codenames: g('codenames', 'Codenames', 'tabletop', 4, 8),
  dixit: g('dixit', 'Dixit', 'tabletop', 3, 6),
  werewolf: g('werewolf', 'Werewolf / Mafija', 'tabletop', 6, 16),
  dnd: g('dnd', 'D&D / RPG', 'tabletop', 3, 6),
  jenga: g('jenga', 'Jenga', 'tabletop', 2, 8),
  scrap: g('scrap', 'Scrap', 'tabletop', 2, 6),
  azul: g('azul', 'Azul', 'tabletop', 2, 4),
  '7_wonders': g('7_wonders', '7 Wonders', 'tabletop', 2, 7),

  // ——— Pub igre ———
  darts: g('darts', 'Pikado', 'pub', 2, 8),
  billiards: g('billiards', 'Bilijar', 'pub', 2, 4),
  table_football: g('table_football', 'Stoni fudbal (foosball)', 'pub', 2, 4),
  bowling: g('bowling', 'Kuglanje', 'pub', 2, 8),
  air_hockey: g('air_hockey', 'Air hockey', 'pub', 2, 2),
  shuffleboard: g('shuffleboard', 'Shuffleboard', 'pub', 2, 4),
  trivia_quiz: g('trivia_quiz', 'Kviz / trivia', 'pub', 2, 20),

  // ——— Gaming / e-sport ———
  fifa: g('fifa', 'FIFA / EA FC', 'esports', 2, 8),
  lol: g('lol', 'League of Legends', 'esports', 2, 10),
  cs2: g('cs2', 'CS2', 'esports', 2, 10),
  valorant: g('valorant', 'Valorant', 'esports', 2, 10),
  dota2: g('dota2', 'Dota 2', 'esports', 2, 10),
  rocket_league: g('rocket_league', 'Rocket League', 'esports', 2, 6),
  fortnite: g('fortnite', 'Fortnite', 'esports', 2, 4),
  call_of_duty: g('call_of_duty', 'Call of Duty', 'esports', 2, 12),
  nba2k: g('nba2k', 'NBA 2K', 'esports', 2, 6),
  smash: g('smash', 'Super Smash Bros', 'esports', 2, 8),
  mario_kart: g('mario_kart', 'Mario Kart', 'esports', 2, 8),
  gaming_generic: g('gaming_generic', 'Gaming (opšte)', 'esports', 2, 10),
};

export const CATEGORY_LIST = Object.values(CATEGORY_META);

export const GAME_TYPE_LIST = Object.values(GAME_TYPES);

export function getGameType(id: string): GameType | undefined {
  return GAME_TYPES[id];
}

export function getGameTypeName(id: string): string {
  return GAME_TYPES[id]?.name || id;
}

export function getGamesByCategory(category: CategoryId): GameType[] {
  return GAME_TYPE_LIST.filter((g) => g.category === category);
}

export function getCategoriesFromGameIds(gameIds: string[]): CategoryId[] {
  const set = new Set<CategoryId>();
  gameIds.forEach((id) => {
    const game = GAME_TYPES[id];
    if (game) set.add(game.category);
  });
  return Array.from(set);
}

/** Legacy / alternate IDs used in older matches & fields */
const SPORT_ALIASES: Record<string, string[]> = {
  football: ['football', 'futsal', 'mali fudbal'],
  table_tennis: ['table_tennis', 'tabletennis', 'stony tenis', 'stoni tenis'],
  basketball: ['basketball', 'kosarka', 'košarka'],
  volleyball: ['volleyball', 'odbojka'],
  tennis: ['tennis', 'tenis'],
  handball: ['handball', 'rukomet'],
  badminton: ['badminton'],
};

function normalizeSportKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolve any legacy/alias/name to canonical GAME_TYPES id, or null */
export function resolveToCanonicalGameId(sportId: string | undefined | null): string | null {
  if (!sportId) return null;
  const sport = normalizeSportKey(sportId);
  if (GAME_TYPES[sport]) return sport;

  for (const [id, aliases] of Object.entries(SPORT_ALIASES)) {
    if (aliases.some((a) => normalizeSportKey(a) === sport)) return id;
  }

  const byName = GAME_TYPE_LIST.find((g) => normalizeSportKey(g.name) === sport);
  return byName?.id || null;
}

/** Options for selects: { value, label } from GAME_TYPES (optionally filtered) */
export function getSportSelectOptions(filterIds?: string[]): { value: string; label: string }[] {
  const list =
    filterIds && filterIds.length > 0
      ? filterIds
          .map((id) => resolveToCanonicalGameId(id) || id)
          .filter((id, i, arr) => GAME_TYPES[id] && arr.indexOf(id) === i)
          .map((id) => GAME_TYPES[id])
      : GAME_TYPE_LIST;

  return list.map((g) => ({ value: g.id, label: g.name }));
}

/** Intersect field sports with user's preferred game ids (canonical) */
export function intersectFieldSportsWithPreferred(
  fieldSports: string[],
  preferredGameIds: string[]
): string[] {
  const preferred = new Set(
    preferredGameIds
      .map((id) => resolveToCanonicalGameId(id) || id)
      .filter((id) => GAME_TYPES[id])
  );

  const result: string[] = [];
  fieldSports.forEach((raw) => {
    const canonical = resolveToCanonicalGameId(raw);
    if (canonical && preferred.has(canonical) && !result.includes(canonical)) {
      result.push(canonical);
    }
  });
  return result;
}

/** True if match.sport matches any preferred game type id (incl. aliases / display names). */
export function matchBelongsToPreferredGames(
  matchSport: string | undefined | null,
  preferredGameIds: string[]
): boolean {
  if (!matchSport || preferredGameIds.length === 0) return false;
  const canonical = resolveToCanonicalGameId(matchSport);
  if (!canonical) {
    // fallback: direct string compare against preferred ids / names
    const sport = normalizeSportKey(matchSport);
    return preferredGameIds.some((id) => {
      const game = GAME_TYPES[id];
      return (
        normalizeSportKey(id) === sport ||
        (game && normalizeSportKey(game.name) === sport)
      );
    });
  }
  return preferredGameIds.some((id) => (resolveToCanonicalGameId(id) || id) === canonical);
}
