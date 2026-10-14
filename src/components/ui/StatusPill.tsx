'use client';

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { TrustBadgeLevel } from '../../lib/reliability';

export type StatusTone = TrustBadgeLevel | 'info' | 'neutral';

const TONES: Record<StatusTone, { bg: string; color: string; label?: string }> = {
  reliable: { bg: '#E3F6EA', color: '#1B8A4B', label: 'Pouzdan' },
  caution: { bg: '#FFE8D9', color: '#D9531E', label: 'Zna da otkaže' },
  risky: { bg: '#FDE2E2', color: '#D92D20', label: 'Rizičan' },
  info: { bg: '#E3EEFF', color: '#0877F9' },
  neutral: { bg: '#EAEFF7', color: '#5B6B8C' },
};

// Icon colors used in list rows (slightly more saturated than the label text)
const ICON_COLORS: Partial<Record<StatusTone, string>> = {
  reliable: '#16A34A',
  caution: '#F5A524',
  risky: '#E5484D',
};

type StatusPillProps = {
  tone: StatusTone;
  /** Overrides the default label of the tone. */
  children?: ReactNode;
  title?: string;
  /** "sm" is the compact variant used in list rows. */
  size?: 'md' | 'sm';
  /** Leading status icon (check for reliable, dot for the others). */
  withIcon?: boolean;
};

/** Small rounded status label (design system "Status / pouzdanost"). */
export default function StatusPill({ tone, children, title, size = 'md', withIcon = false }: StatusPillProps) {
  const spec = TONES[tone];
  const small = size === 'sm';
  const iconSize = small ? 15 : 17;
  const iconColor = ICON_COLORS[tone] ?? spec.color;

  return (
    <Box
      title={title}
      sx={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        px: small ? '8px' : '12px',
        py: small ? '3px' : '6px',
        borderRadius: small ? '8px' : '10px',
        fontSize: small ? 12.5 : 13.5,
        fontWeight: small ? 600 : 700,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        bgcolor: spec.bg,
        color: spec.color,
      }}
    >
      {withIcon &&
        (tone === 'reliable' ? (
          <CheckCircleIcon sx={{ fontSize: iconSize, color: iconColor }} />
        ) : (
          <Box
            aria-hidden
            sx={{
              width: iconSize - 2,
              height: iconSize - 2,
              borderRadius: '50%',
              bgcolor: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#fff' }} />
          </Box>
        ))}
      {children ?? spec.label}
    </Box>
  );
}
