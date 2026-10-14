'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Drawer,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Slider,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export type HomeScope = 'mine' | 'all' | 'preferred';

export const MIN_RADIUS_KM = 1;
export const MID_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

// Slider uses a piecewise scale: 1–10 km on the left half, 10–50 km on the right half
function kmToPosition(km: number): number {
  if (km <= MID_RADIUS_KM) return ((km - MIN_RADIUS_KM) / (MID_RADIUS_KM - MIN_RADIUS_KM)) * 50;
  return 50 + ((km - MID_RADIUS_KM) / (MAX_RADIUS_KM - MID_RADIUS_KM)) * 50;
}

function positionToKm(pos: number): number {
  const km =
    pos <= 50
      ? MIN_RADIUS_KM + (pos / 50) * (MID_RADIUS_KM - MIN_RADIUS_KM)
      : MID_RADIUS_KM + ((pos - 50) / 50) * (MAX_RADIUS_KM - MID_RADIUS_KM);
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(km)));
}

function ScopeOption({
  value,
  title,
  description,
}: {
  value: HomeScope;
  title: string;
  description: ReactNode;
}) {
  return (
    <FormControlLabel
      value={value}
      control={
        <Radio
          disableRipple
          sx={{
            p: 0,
            mr: '14px',
            mt: '2px',
            color: '#C3D0E6',
            '&.Mui-checked': { color: 'primary.main' },
            '& .MuiSvgIcon-root': { fontSize: 26 },
          }}
        />
      }
      label={
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: 'text.primary' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 400, lineHeight: 1.4, color: 'text.secondary' }}>
            {description}
          </Typography>
        </Box>
      }
      sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
    />
  );
}

type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  scope: HomeScope;
  radiusKm: number;
  /** Show the "what do you want to see" options (logged-in players). */
  showScope: boolean;
  /** Show the extra "my sports" option (players with preferred sports). */
  showPreferred: boolean;
  onApply: (scope: HomeScope, radiusKm: number) => void;
};

/** Bottom sheet "Šta želiš da vidiš?" — scope radio options + distance slider. */
export default function FilterSheet({
  open,
  onClose,
  scope,
  radiusKm,
  showScope,
  showPreferred,
  onApply,
}: FilterSheetProps) {
  const [draftScope, setDraftScope] = useState<HomeScope>(scope);
  const [draftRadius, setDraftRadius] = useState<number>(radiusKm);

  useEffect(() => {
    if (open) {
      setDraftScope(scope);
      setDraftRadius(radiusKm);
    }
  }, [open, scope, radiusKm]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(11, 27, 63, 0.28)', backdropFilter: 'blur(6px)' },
        },
        paper: {
          sx: {
            left: 0,
            right: 0,
            mx: 'auto',
            width: '100%',
            maxWidth: 520,
            bgcolor: '#FFFFFF',
            borderRadius: '24px 24px 0 0',
            border: 'none',
            px: '20px',
            pt: '20px',
            pb: 'calc(20px + env(safe-area-inset-bottom))',
          },
        },
      }}
    >
      <Box role="dialog" aria-labelledby="filter-sheet-title">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '16px' }}>
          <Typography
            id="filter-sheet-title"
            component="h2"
            sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary' }}
          >
            Šta želiš da vidiš?
          </Typography>
          <IconButton
            aria-label="Zatvori"
            onClick={onClose}
            edge="end"
            sx={{ color: 'text.secondary', mr: '-6px' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {showScope && (
          <RadioGroup
            value={draftScope}
            onChange={(e) => setDraftScope(e.target.value as HomeScope)}
            sx={{ gap: '18px', mb: '24px' }}
          >
            <ScopeOption
              value="mine"
              title="Moje igre"
              description="Samo mečevi na koje sam se prijavio ili koje sam okupio"
            />
            <ScopeOption value="all" title="Sve igre" description="Svi javni mečevi u blizini" />
            {showPreferred && (
              <ScopeOption
                value="preferred"
                title="Moji sportovi"
                description="Mečevi u sportovima koje sam izabrao u profilu"
              />
            )}
          </RadioGroup>
        )}

        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'text.primary' }}>Udaljenost</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'primary.main' }}>
            {draftRadius} km
          </Typography>
        </Box>

        <Box sx={{ px: '12px', mt: '4px', mb: '20px' }}>
          <Slider
            value={kmToPosition(draftRadius)}
            min={0}
            max={100}
            step={0.5}
            onChange={(_, v) => setDraftRadius(positionToKm(v as number))}
            aria-label="Udaljenost"
            getAriaValueText={() => `${draftRadius} km`}
            valueLabelDisplay="off"
            marks={[
              { value: 0, label: `${MIN_RADIUS_KM} km` },
              { value: 50, label: `${MID_RADIUS_KM} km` },
              { value: 100, label: `${MAX_RADIUS_KM} km` },
            ]}
            sx={{
              height: 6,
              '& .MuiSlider-rail': { bgcolor: '#DCE5F2', opacity: 1 },
              '& .MuiSlider-track': { border: 'none', bgcolor: 'primary.main' },
              '& .MuiSlider-mark': { display: 'none' },
              '& .MuiSlider-thumb': {
                width: 22,
                height: 22,
                bgcolor: 'primary.main',
                border: '3px solid #FFFFFF',
                boxShadow: '0 1px 4px rgba(11, 27, 63, 0.35)',
                '&:before': { display: 'none' },
                '&:hover, &.Mui-focusVisible, &.Mui-active': {
                  boxShadow: '0 0 0 6px rgba(8, 119, 249, 0.16)',
                },
              },
              '& .MuiSlider-markLabel': {
                fontSize: 13,
                fontWeight: 500,
                color: 'text.secondary',
                top: 30,
                '&[data-index="0"]': { transform: 'translateX(-12px)' },
                '&[data-index="2"]': { transform: 'translateX(-100%) translateX(12px)' },
              },
            }}
          />
        </Box>

        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onApply(draftScope, draftRadius);
            onClose();
          }}
          sx={{ height: 50, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          Prikaži mečeve
        </Button>
        <Button
          fullWidth
          onClick={() => setDraftRadius(MID_RADIUS_KM)}
          sx={{
            mt: '10px',
            height: 50,
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 600,
            color: 'primary.main',
            bgcolor: '#EEF5FF',
            '&:hover': { bgcolor: '#E2EEFF' },
          }}
        >
          Vrati na {MID_RADIUS_KM} km
        </Button>
      </Box>
    </Drawer>
  );
}
