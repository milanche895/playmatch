'use client';

import type { ReactNode } from 'react';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Generic bottom sheet: blurred backdrop, rounded top corners, title + close button, scrollable body. */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
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
            maxHeight: '90vh',
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
      <Box role="dialog" aria-label={title}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '16px' }}>
          <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary' }}>
            {title}
          </Typography>
          <IconButton aria-label="Zatvori" onClick={onClose} edge="end" sx={{ color: 'text.secondary', mr: '-6px' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        {children}
      </Box>
    </Drawer>
  );
}
