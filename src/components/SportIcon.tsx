'use client';

import type { ElementType } from 'react';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import SportsVolleyballIcon from '@mui/icons-material/SportsVolleyball';
import SportsHandballIcon from '@mui/icons-material/SportsHandball';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import CasinoIcon from '@mui/icons-material/Casino';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { GAME_TYPES } from '../constants/games';

type IconSpec = { Icon: ElementType; color: string };

const BY_SPORT: Record<string, IconSpec> = {
  football: { Icon: SportsSoccerIcon, color: '#111827' },
  football_11: { Icon: SportsSoccerIcon, color: '#111827' },
  basketball: { Icon: SportsBasketballIcon, color: '#F97316' },
  basketball_3x3: { Icon: SportsBasketballIcon, color: '#F97316' },
  nba2k: { Icon: SportsBasketballIcon, color: '#F97316' },
  padel: { Icon: SportsTennisIcon, color: '#0877F9' },
  tennis: { Icon: SportsTennisIcon, color: '#0877F9' },
  squash: { Icon: SportsTennisIcon, color: '#0877F9' },
  badminton: { Icon: SportsTennisIcon, color: '#0877F9' },
  table_tennis: { Icon: SportsTennisIcon, color: '#0877F9' },
  volleyball: { Icon: SportsVolleyballIcon, color: '#F59E0B' },
  beach_volleyball: { Icon: SportsVolleyballIcon, color: '#F59E0B' },
  handball: { Icon: SportsHandballIcon, color: '#0877F9' },
};

const BY_CATEGORY: Record<string, IconSpec> = {
  sport: { Icon: SportsScoreIcon, color: '#0877F9' },
  tabletop: { Icon: CasinoIcon, color: '#7C3AED' },
  pub: { Icon: SportsBarIcon, color: '#F97316' },
  esports: { Icon: SportsEsportsIcon, color: '#7C3AED' },
};

/** Colored sport glyph used on match cards. */
export default function SportIcon({ sport, size = 44 }: { sport: string; size?: number }) {
  const spec =
    BY_SPORT[sport] ?? BY_CATEGORY[GAME_TYPES[sport]?.category ?? 'sport'] ?? BY_CATEGORY.sport;
  const { Icon, color } = spec;
  return <Icon aria-hidden sx={{ fontSize: size, color, flexShrink: 0 }} />;
}
