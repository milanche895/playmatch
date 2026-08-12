import { Box, Stack, Typography, SxProps, Theme } from '@mui/material';
import { useId } from 'react';
import { brand } from '../theme';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<LogoSize, number> = {
  sm: 32,
  md: 44,
  lg: 72,
  xl: 112,
};

/** SVG mark — stylized P + play + motion streaks */
export function PlejkoMark({
  size = 'md',
  sx,
}: {
  size?: LogoSize | number;
  sx?: SxProps<Theme>;
}) {
  const px = typeof size === 'number' ? size : sizeMap[size];
  const uid = useId().replace(/:/g, '');

  return (
    <Box
      component="svg"
      viewBox="0 0 120 120"
      width={px}
      height={px}
      sx={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(0,212,255,0.25))', ...sx }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-p`} x1="20%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="40%" stopColor="#2B6CFF" />
          <stop offset="100%" stopColor="#E000FF" />
        </linearGradient>
        <linearGradient id={`${uid}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5CE1FF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#D400FF" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <rect x="8" y="38" width="22" height="8" rx="4" fill={brand.green} />
      <rect x="4" y="54" width="28" height="8" rx="4" fill={brand.orange} />
      <rect x="10" y="70" width="18" height="8" rx="4" fill={brand.magenta} />

      <path
        d="M38 22
           C38 18 42 14 48 14
           H78
           C98 14 110 28 110 48
           C110 68 98 82 78 82
           H58
           V106
           C58 110 54 114 50 114
           C46 114 42 110 42 106
           V28
           C42 24 40 22 38 22
           Z
           M58 36
           V60
           H76
           C86 60 92 54 92 48
           C92 42 86 36 76 36
           H58
           Z"
        fill={`url(#${uid}-p)`}
      />

      <path
        d="M48 20 H74 C90 20 100 30 102 42 C88 28 70 24 48 28 Z"
        fill={`url(#${uid}-glow)`}
        opacity="0.55"
      />

      <path
        d="M62 40 L86 52 L62 64 Z"
        fill="#050A18"
        stroke="#050A18"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M66 44 L80 52 L66 60 Z" fill="#FFFFFF" />
    </Box>
  );
}

export function PlejkoTagline({
  sx,
  compact = false,
}: {
  sx?: SxProps<Theme>;
  compact?: boolean;
}) {
  const dots = [brand.green, brand.magenta, brand.orange];
  const words = ['PRONAĐI', 'OKUPI', 'IGRAJ'];

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={compact ? 0.75 : 1}
      flexWrap="wrap"
      justifyContent="center"
      sx={sx}
    >
      {words.map((word, i) => (
        <Stack key={word} direction="row" alignItems="center" spacing={compact ? 0.75 : 1}>
          <Typography
            variant="overline"
            sx={{
              color: 'inherit',
              opacity: 0.92,
              letterSpacing: compact ? '0.14em' : '0.18em',
              fontSize: compact ? '0.62rem' : '0.72rem',
              lineHeight: 1,
              m: 0,
            }}
          >
            {word}
          </Typography>
          {i < words.length - 1 && (
            <Box
              sx={{
                width: compact ? 5 : 6,
                height: compact ? 5 : 6,
                borderRadius: '50%',
                bgcolor: dots[i],
                boxShadow: `0 0 8px ${dots[i]}`,
              }}
            />
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function PlejkoWordmark({
  fontSize,
  color,
}: {
  fontSize: string;
  color: string;
}) {
  const isLightText = color === '#fff' || color === '#FFFFFF';

  return (
    <Typography
      component="span"
      sx={{
        fontFamily: '"Nunito", sans-serif',
        fontWeight: 800,
        fontSize,
        color,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
    >
      Ple
      <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
        j
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '-0.45em',
            transform: 'translateX(-50%)',
            width: '0.7em',
            height: '0.55em',
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              transform: 'translateX(-50%)',
              width: '0.28em',
              height: '0.28em',
              borderRadius: '50%',
              bgcolor: isLightText ? '#fff' : 'text.primary',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '8%',
              top: '5%',
              width: '0.18em',
              height: '0.38em',
              borderRadius: 2,
              bgcolor: brand.green,
              transform: 'rotate(-30deg)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '42%',
              top: 0,
              width: '0.18em',
              height: '0.42em',
              borderRadius: 2,
              bgcolor: brand.yellow,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              right: '8%',
              top: '5%',
              width: '0.18em',
              height: '0.38em',
              borderRadius: 2,
              bgcolor: brand.magenta,
              transform: 'rotate(30deg)',
            }}
          />
        </Box>
      </Box>
      ko
    </Typography>
  );
}

type PlejkoLogoProps = {
  size?: LogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  color?: string;
  align?: 'flex-start' | 'center';
  sx?: SxProps<Theme>;
};

/** Full brand lockup: mark + Plejko (+ optional tagline) */
export default function PlejkoLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  color = 'text.primary',
  align = 'flex-start',
  sx,
}: PlejkoLogoProps) {
  const wordSize =
    size === 'xl' ? '2.75rem' : size === 'lg' ? '2rem' : size === 'md' ? '1.35rem' : '1.1rem';

  return (
    <Stack alignItems={align} spacing={showTagline ? 0.75 : 0} sx={sx}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <PlejkoMark size={size} />
        {showWordmark && <PlejkoWordmark fontSize={wordSize} color={color} />}
      </Stack>
      {showTagline && (
        <PlejkoTagline
          compact={size === 'sm' || size === 'md'}
          sx={{ color, justifyContent: align === 'center' ? 'center' : 'flex-start' }}
        />
      )}
    </Stack>
  );
}
