'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CheckIcon from '@mui/icons-material/Check';

const REASONS = ['Promenili su mi se planovi', 'Povreda / zdravstveni razlog', 'Drugo'] as const;
const OTHER = REASONS[2];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the reason text (sent as the cancellation comment). */
  onConfirm: (comment: string) => void;
  loading?: boolean;
  /** Reliability points the player loses if they cancel now (0 = no penalty). */
  penaltyPoints: number;
};

/** Bottom sheet "Ne dolaziš?" — pick a reason and confirm leaving the match. */
export default function CancelAttendanceSheet({ open, onClose, onConfirm, loading = false, penaltyPoints }: Props) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    if (open) {
      setReason(REASONS[0]);
      setOtherText('');
    }
  }, [open]);

  const hasPenalty = penaltyPoints > 0;
  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleConfirm = () => {
    const comment = reason === OTHER ? otherText.trim() || OTHER : reason;
    onConfirm(comment);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
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
      <Box role="dialog" aria-labelledby="cancel-sheet-title">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '14px' }}>
          <Typography
            id="cancel-sheet-title"
            component="h2"
            sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary' }}
          >
            Ne dolaziš?
          </Typography>
          <IconButton aria-label="Zatvori" onClick={handleClose} edge="end" sx={{ color: 'text.secondary', mr: '-6px' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Typography sx={{ fontSize: 15, color: 'text.secondary', mb: '14px' }}>Izaberi razlog odjave:</Typography>

        <RadioGroup value={reason} onChange={(e) => setReason(e.target.value)} sx={{ gap: '14px', mb: '20px' }}>
          {REASONS.map((r) => (
            <FormControlLabel
              key={r}
              value={r}
              disabled={loading}
              control={
                <Radio
                  disableRipple
                  sx={{
                    p: 0,
                    mr: '14px',
                    color: '#C3D0E6',
                    '&.Mui-checked': { color: 'primary.main' },
                    '& .MuiSvgIcon-root': { fontSize: 26 },
                  }}
                />
              }
              label={<Typography sx={{ fontSize: 16, fontWeight: 500, color: 'text.primary' }}>{r}</Typography>}
              sx={{ m: 0, width: '100%' }}
            />
          ))}
        </RadioGroup>

        {reason === OTHER && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Napiši razlog (opciono)"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
            disabled={loading}
            sx={{
              mb: '20px',
              '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: '#F4F7FC', '& fieldset': { borderColor: '#E3E9F3' } },
            }}
          />
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            p: '14px',
            mb: '20px',
            borderRadius: '14px',
            bgcolor: hasPenalty ? '#FFF3E3' : '#EAF7EF',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: hasPenalty ? '#F59E0B' : '#1B8A4B',
              color: '#fff',
            }}
          >
            {hasPenalty ? <PriorityHighIcon sx={{ fontSize: 20 }} /> : <CheckIcon sx={{ fontSize: 20 }} />}
          </Box>
          <Typography
            sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: hasPenalty ? '#B4540A' : '#17703E' }}
          >
            {hasPenalty
              ? `Ako sada otkažeš, tvoja pouzdanost pada (−${penaltyPoints}).`
              : 'Otkazivanje je sada bez posledica po tvoju pouzdanost.'}
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="destructive"
          disabled={loading}
          onClick={handleConfirm}
          sx={{ height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          {loading ? 'Odjavljivanje...' : 'Ipak se odjavi'}
        </Button>
        <Button
          fullWidth
          variant="soft"
          disabled={loading}
          onClick={handleClose}
          sx={{ mt: '10px', height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          Odustani
        </Button>
      </Box>
    </Drawer>
  );
}
