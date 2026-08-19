import { useState, type ReactElement, type ReactNode } from 'react';
import { Box, Chip, Stack, Typography, Alert } from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CasinoIcon from '@mui/icons-material/Casino';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  CATEGORY_LIST,
  CategoryId,
  getCategoriesFromGameIds,
  getGamesByCategory,
  getGameTypeName,
} from '../constants/games';
import { brand } from '../theme';

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

type PreferredGamesPickerProps = {
  value: string[];
  onChange: (gameIds: string[]) => void;
  disabled?: boolean;
};

/**
 * Multi-select: categories + game types.
 * Step 1: pick one or more categories → Step 2: pick any games from those categories.
 */
export default function PreferredGamesPicker({
  value,
  onChange,
  disabled = false,
}: PreferredGamesPickerProps) {
  // Categories stay selected independently of which games are picked
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>(() =>
    getCategoriesFromGameIds(value)
  );

  function toggleCategory(category: CategoryId) {
    if (disabled) return;

    const isSelected = selectedCategories.includes(category);
    if (isSelected) {
      const nextCategories = selectedCategories.filter((c) => c !== category);
      setSelectedCategories(nextCategories);
      const allowed = new Set(
        nextCategories.flatMap((c) => getGamesByCategory(c).map((game) => game.id))
      );
      onChange(value.filter((id) => allowed.has(id)));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  }

  function toggleGame(gameId: string) {
    if (disabled) return;
    if (value.includes(gameId)) {
      onChange(value.filter((id) => id !== gameId));
    } else {
      onChange([...value, gameId]);
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          1. Odaberi kategorije
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Možeš izabrati više kategorija odjednom
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {CATEGORY_LIST.map((cat) => {
            const active = selectedCategories.includes(cat.id);
            return (
              <Chip
                key={cat.id}
                icon={categoryIcons[cat.id] as ReactElement}
                label={cat.label}
                onClick={() => toggleCategory(cat.id)}
                disabled={disabled}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 700,
                  minHeight: 40,
                  borderColor: active ? undefined : categoryColors[cat.id],
                  '& .MuiChip-icon': {
                    color: active ? 'inherit' : categoryColors[cat.id],
                  },
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          2. Odaberi igre / sportove
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {selectedCategories.length === 0
            ? 'Izaberi barem jednu kategoriju da vidiš dostupne opcije'
            : 'Možeš izabrati više igara iz svake kategorije'}
        </Typography>

        {selectedCategories.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Nije izabrana nijedna kategorija.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {selectedCategories.map((categoryId) => {
              const games = getGamesByCategory(categoryId);
              const meta = CATEGORY_LIST.find((c) => c.id === categoryId);
              return (
                <Box key={categoryId}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ color: categoryColors[categoryId], display: 'block', mb: 1 }}
                  >
                    {meta?.label} · {games.length} opcija
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {games.map((game) => {
                      const active = value.includes(game.id);
                      return (
                        <Chip
                          key={game.id}
                          label={game.name}
                          onClick={() => toggleGame(game.id)}
                          disabled={disabled}
                          color={active ? 'secondary' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 600, minHeight: 40 }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {value.length > 0 && (
        <Alert severity="success" sx={{ borderRadius: 2 }} icon={false}>
          <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
            Odabrano ({value.length}):
          </Typography>
          <Typography variant="body2">{value.map(getGameTypeName).join(' · ')}</Typography>
        </Alert>
      )}
    </Stack>
  );
}
