import { Box, Chip, Stack, Typography, Alert } from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CasinoIcon from '@mui/icons-material/Casino';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  CATEGORY_LIST,
  CategoryId,
  getGamesByCategory,
  getGameType,
} from '../constants/games';
import { brand } from '../theme';
import type { ReactElement, ReactNode } from 'react';

const categoryIcons: Record<CategoryId, ReactNode> = {
  sport: <SportsSoccerIcon fontSize="small" />,
  tabletop: <CasinoIcon fontSize="small" />,
  pub: <SportsBarIcon fontSize="small" />,
  esports: <SportsEsportsIcon fontSize="small" />,
};

const categoryColors: Record<CategoryId, string> = {
  sport: brand.green,
  tabletop: brand.cyan,
  pub: brand.orange,
  esports: brand.magenta,
};

type Props = {
  category: CategoryId | null;
  gameTypeId: string | null;
  onCategoryChange: (category: CategoryId | null) => void;
  onGameTypeChange: (gameTypeId: string | null) => void;
  required?: boolean;
  disabled?: boolean;
};

/** Single category + single game type (registration / onboarding) */
export default function SingleGamePreferencePicker({
  category,
  gameTypeId,
  onCategoryChange,
  onGameTypeChange,
  required = false,
  disabled = false,
}: Props) {
  const games = category ? getGamesByCategory(category) : [];

  function selectCategory(next: CategoryId) {
    if (disabled) return;
    if (category === next) {
      onCategoryChange(null);
      onGameTypeChange(null);
      return;
    }
    onCategoryChange(next);
    // Clear game if it doesn't belong to the new category
    if (gameTypeId) {
      const current = getGameType(gameTypeId);
      if (!current || current.category !== next) {
        onGameTypeChange(null);
      }
    }
  }

  function selectGame(id: string) {
    if (disabled) return;
    onGameTypeChange(gameTypeId === id ? null : id);
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          Šta najviše igraš?{required ? ' *' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Izaberi jednu kategoriju, pa jednu igru — prikazaćemo ti relevantne mečeve
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {CATEGORY_LIST.map((cat) => {
            const active = category === cat.id;
            return (
              <Chip
                key={cat.id}
                icon={categoryIcons[cat.id] as ReactElement}
                label={cat.label}
                onClick={() => selectCategory(cat.id)}
                disabled={disabled}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 700,
                  minHeight: 40,
                  borderColor: active ? undefined : categoryColors[cat.id],
                  '& .MuiChip-icon': { color: active ? 'inherit' : categoryColors[cat.id] },
                }}
              />
            );
          })}
        </Box>
      </Box>

      {category && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Izaberi igru
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {games.map((game) => {
              const active = gameTypeId === game.id;
              return (
                <Chip
                  key={game.id}
                  label={game.name}
                  onClick={() => selectGame(game.id)}
                  disabled={disabled}
                  color={active ? 'secondary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600, minHeight: 40 }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {required && category && !gameTypeId && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Izaberi i konkretnu igru da nastavimo.
        </Alert>
      )}
    </Stack>
  );
}
