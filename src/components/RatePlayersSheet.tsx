'use client';

import { Avatar, Box, Button, ButtonBase, Stack, Switch, Typography } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import BottomSheet from './BottomSheet';
import SegmentedControl from './ui/SegmentedControl';
import type { PendingRatingUser } from '../types';

export type PlayerRatingValue = { stars: number; fairPlay: boolean; skillLevel: number };

type Props = {
  open: boolean;
  onClose: () => void;
  players: PendingRatingUser[];
  /** Localized sport name, shown in the skill label. */
  sportName: string;
  values: Record<string, PlayerRatingValue>;
  onChange: (playerId: string, patch: Partial<PlayerRatingValue>) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

const DEFAULT_VALUE: PlayerRatingValue = { stars: 5, fairPlay: true, skillLevel: 3 };
const SKILL_OPTIONS = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', mb: '8px' }}>{children}</Typography>
  );
}

/** Bottom sheet "Oceni saigrače": stars, per-sport skill (1–5) and fair-play toggle for every pending player. */
export default function RatePlayersSheet({
  open,
  onClose,
  players,
  sportName,
  values,
  onChange,
  onSubmit,
  submitting = false,
}: Props) {
  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Oceni saigrače">
      <Stack spacing="14px" sx={{ mb: '20px' }}>
        {players.map((p) => {
          const value = values[p._id] ?? DEFAULT_VALUE;
          return (
            <Box
              key={p._id}
              sx={{
                p: '16px',
                borderRadius: '16px',
                border: '1px solid #E3E9F3',
                bgcolor: '#FFFFFF',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: '16px' }}>
                <Avatar sx={{ width: 44, height: 44, bgcolor: '#E3EEFF', color: 'primary.main', fontWeight: 700 }}>
                  {p.name?.charAt(0).toUpperCase() || '?'}
                </Avatar>
                <Typography noWrap sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary' }}>
                  {p.name}
                </Typography>
              </Box>

              <FieldLabel>Zvezdice (1-5)</FieldLabel>
              <Box
                role="radiogroup"
                aria-label={`Zvezdice za ${p.name}`}
                sx={{ display: 'flex', gap: '6px', mb: '18px' }}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= value.stars;
                  return (
                    <ButtonBase
                      key={n}
                      role="radio"
                      aria-checked={value.stars === n}
                      aria-label={`${n}`}
                      disabled={submitting}
                      onClick={() => onChange(p._id, { stars: n })}
                      sx={{ borderRadius: '10px', p: '2px' }}
                    >
                      {filled ? (
                        <StarRoundedIcon sx={{ fontSize: 38, color: '#F5A524' }} />
                      ) : (
                        <StarBorderRoundedIcon sx={{ fontSize: 38, color: '#C3D0E6' }} />
                      )}
                    </ButtonBase>
                  );
                })}
              </Box>

              <FieldLabel>{`Veština (${sportName}) 1-5`}</FieldLabel>
              <Box sx={{ mb: '18px' }}>
                <SegmentedControl
                  value={String(value.skillLevel)}
                  options={SKILL_OPTIONS}
                  onChange={(v) => onChange(p._id, { skillLevel: Number(v) })}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: '14px',
                  py: '6px',
                  borderRadius: '12px',
                  bgcolor: value.fairPlay ? '#EAF7EF' : '#F4F7FC',
                }}
              >
                <Typography
                  sx={{ fontSize: 15, fontWeight: 700, color: value.fairPlay ? '#17703E' : 'text.primary' }}
                >
                  Fer-plej: {value.fairPlay ? 'Da' : 'Ne'}
                </Typography>
                <Switch
                  checked={value.fairPlay}
                  disabled={submitting}
                  onChange={(e) => onChange(p._id, { fairPlay: e.target.checked })}
                  inputProps={{ 'aria-label': `Fer-plej za ${p.name}` }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#1B8A4B' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#1B8A4B', opacity: 0.5 },
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Button
        fullWidth
        variant="contained"
        disabled={submitting}
        onClick={onSubmit}
        sx={{ height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
      >
        {submitting ? 'Slanje...' : 'Sačuvaj ocene'}
      </Button>
      <Button
        fullWidth
        variant="soft"
        disabled={submitting}
        onClick={handleClose}
        sx={{ mt: '10px', height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
      >
        Kasnije
      </Button>
    </BottomSheet>
  );
}
