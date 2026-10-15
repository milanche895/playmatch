import { Box, Stack, Typography, SxProps, Theme, useTheme } from '@mui/material';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

/** Mark height (px) for the horizontal lockup / standalone mark. */
const markHeight: Record<LogoSize, number> = {
  sm: 40,
  md: 52,
  lg: 72,
  xl: 112,
};

/** Total height (px) of the stacked lockup (mark above wordmark). */
const stackedHeight: Record<LogoSize, number> = {
  sm: 72,
  md: 112,
  lg: 150,
  xl: 200,
};

// Brand artwork lives in /public/brand (built with scripts/build-brand-assets.js)
const ASSETS = {
  lockup: { dark: '/brand/plejko-logo.png', light: '/brand/plejko-logo-light.png', ratio: 579 / 528 },
  mark: { dark: '/brand/plejko-mark.png', light: '/brand/plejko-mark-light.png', ratio: 398 / 345 },
  wordmark: { dark: '/brand/plejko-wordmark.png', light: '/brand/plejko-wordmark-light.png', ratio: 575 / 191 },
};

function isLightText(color: string) {
  const c = color.toLowerCase();
  return c === '#fff' || c === '#ffffff' || c === 'white';
}

/** True when the logo sits on a dark surface and the white-wordmark artwork should be used. */
function useOnDark(color: string) {
  const theme = useTheme();
  return isLightText(color) || theme.palette.mode === 'dark';
}

/** Brand mark: runner + swoosh + ball. */
export function PlejkoMark({
  size = 'md',
  sx,
  onDark,
}: {
  size?: LogoSize | number;
  sx?: SxProps<Theme>;
  onDark?: boolean;
}) {
  const theme = useTheme();
  const dark = onDark ?? theme.palette.mode === 'dark';
  const h = typeof size === 'number' ? size : markHeight[size];
  return (
    <Box
      component="img"
      src={dark ? ASSETS.mark.light : ASSETS.mark.dark}
      alt=""
      aria-hidden
      draggable={false}
      sx={{ display: 'block', flexShrink: 0, height: h, width: h * ASSETS.mark.ratio, ...sx }}
    />
  );
}

/** "PRONAĐI. OKUPI. IGRAJ." */
export function PlejkoTagline({
  sx,
  compact = false,
}: {
  sx?: SxProps<Theme>;
  compact?: boolean;
}) {
  return (
    <Typography
      variant="overline"
      sx={{
        color: 'inherit',
        opacity: 0.85,
        letterSpacing: compact ? '0.14em' : '0.18em',
        fontSize: compact ? '0.62rem' : '0.72rem',
        lineHeight: 1,
        m: 0,
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      PRONAĐI. OKUPI. IGRAJ.
    </Typography>
  );
}

type PlejkoLogoProps = {
  size?: LogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  color?: string;
  align?: 'flex-start' | 'center';
  /** horizontal: mark + wordmark side by side; stacked: mark above wordmark (splash / welcome). */
  layout?: 'horizontal' | 'stacked';
  sx?: SxProps<Theme>;
};

/** Full brand lockup: mark + Plejko (+ optional tagline) */
export default function PlejkoLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  color = 'text.primary',
  align = 'flex-start',
  layout = 'horizontal',
  sx,
}: PlejkoLogoProps) {
  const onDark = useOnDark(color);
  const variant = onDark ? 'light' : 'dark';

  let artwork;
  if (showWordmark && layout === 'stacked') {
    const h = stackedHeight[size];
    artwork = (
      <Box
        component="img"
        src={ASSETS.lockup[variant]}
        alt="Plejko"
        draggable={false}
        sx={{ display: 'block', height: h, width: h * ASSETS.lockup.ratio }}
      />
    );
  } else {
    const mh = markHeight[size];
    const wh = Math.round(mh * 0.55);
    artwork = (
      <Stack direction="row" alignItems="center" spacing={`${Math.round(mh * 0.14)}px`}>
        <PlejkoMark size={size} onDark={onDark} />
        {showWordmark && (
          <Box
            component="img"
            src={ASSETS.wordmark[variant]}
            alt="Plejko"
            draggable={false}
            sx={{ display: 'block', height: wh, width: wh * ASSETS.wordmark.ratio }}
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack alignItems={align} spacing={showTagline ? 0.75 : 0} sx={sx}>
      {artwork}
      {showTagline && (
        <PlejkoTagline
          compact={size === 'sm' || size === 'md'}
          sx={{ color, justifyContent: align === 'center' ? 'center' : 'flex-start' }}
        />
      )}
    </Stack>
  );
}
