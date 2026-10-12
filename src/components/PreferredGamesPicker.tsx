import { type ReactElement, type ReactNode } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CasinoIcon from '@mui/icons-material/Casino';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  CATEGORY_LIST,
  CategoryId,
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
  categoryTitle?: string;
  categoryHint?: string;
  gamesTitle?: string;
  gamesHint?: string;
};

/**
 * One dropdown per category. Opening a category lets you multi-select game types.
 */
export default function PreferredGamesPicker({
  value,
  onChange,
  disabled = false,
  categoryTitle = 'Odaberi igre',
  categoryHint = 'Otvori kategoriju i izaberi jednu ili više igara',
}: PreferredGamesPickerProps) {
  function handleCategoryChange(category: CategoryId, event: SelectChangeEvent<string[]>) {
    if (disabled) return;
    const nextInCategory = event.target.value as string[];
    const categoryGameIds = new Set(getGamesByCategory(category).map((game) => game.id));
    const kept = value.filter((id) => !categoryGameIds.has(id));
    onChange([...kept, ...nextInCategory]);
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          {categoryTitle}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {categoryHint}
        </Typography>
      </Box>

      {CATEGORY_LIST.map((cat) => {
        const games = getGamesByCategory(cat.id);
        const selected = games.filter((game) => value.includes(game.id)).map((game) => game.id);

        return (
          <FormControl key={cat.id} fullWidth disabled={disabled}>
            <InputLabel id={`games-${cat.id}-label`}>
              {cat.label}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </InputLabel>
            <Select
              labelId={`games-${cat.id}-label`}
              multiple
              value={selected}
              label={`${cat.label}${selected.length > 0 ? ` (${selected.length})` : ''}`}
              onChange={(event) => handleCategoryChange(cat.id, event)}
              startAdornment={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    pl: 0.5,
                    color: categoryColors[cat.id],
                  }}
                >
                  {categoryIcons[cat.id] as ReactElement}
                </Box>
              }
              renderValue={(picked) =>
                picked.length === 0
                  ? cat.description
                  : picked.map((id) => getGameTypeName(id)).join(', ')
              }
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 320, borderRadius: 2 },
                },
              }}
            >
              {games.map((game) => (
                <MenuItem key={game.id} value={game.id}>
                  <Checkbox checked={selected.includes(game.id)} size="small" />
                  <ListItemText primary={game.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      })}

      {value.length > 0 && (
        <Alert severity="success" sx={{ borderRadius: 2 }} icon={false}>
          <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 1 }}>
            Odabrano ({value.length}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {value.map((id) => (
              <Chip
                key={id}
                label={getGameTypeName(id)}
                size="small"
                color="secondary"
                onDelete={disabled ? undefined : () => onChange(value.filter((gameId) => gameId !== id))}
              />
            ))}
          </Box>
        </Alert>
      )}
    </Stack>
  );
}
