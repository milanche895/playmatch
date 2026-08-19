import { Box, Button, Chip, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import CasinoIcon from '@mui/icons-material/Casino';
import { Link as RouterLink } from '@/lib/router';
import PlejkoLogo, { PlejkoTagline } from './PlejkoLogo';
import { brand } from '../theme';
import { useAuth } from '../context/AuthContext';
import heroBanner from '../assets/brand/desktop-hero.png';

const categories = [
  { label: 'Sport', icon: <SportsSoccerIcon fontSize="small" />, color: brand.green },
  { label: 'Gaming', icon: <SportsEsportsIcon fontSize="small" />, color: brand.purple },
  { label: 'Društvene igre', icon: <CasinoIcon fontSize="small" />, color: brand.cyan },
];

/** Branded hero — lifestyle banner + CTAs (guest-focused, compact when logged in) */
export default function BrandHero() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  if (user) {
    return (
      <Box
        sx={{
          mb: 3,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          background: isDark
            ? `linear-gradient(135deg, ${brand.navySoft} 0%, ${brand.navyCard} 60%, rgba(212,0,255,0.12) 100%)`
            : `linear-gradient(135deg, #EEF7FF 0%, #F5EEFF 100%)`,
          px: { xs: 2.5, sm: 3 },
          py: { xs: 2, sm: 2.5 },
        }}
      >
        <Stack
          direction="column"
          spacing={2}
          alignItems="center"
          textAlign="center"
        >
          <Typography variant="body2" color="text.secondary">
            Više od igre. Ljudi. Mečevi. Dobre priče.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
            {categories.map((c) => (
              <Chip
                key={c.label}
                icon={c.icon}
                label={c.label}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: c.color,
                  color: isDark ? '#fff' : 'text.primary',
                  '& .MuiChip-icon': { color: c.color },
                }}
              />
            ))}
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: { xs: 3, md: 4 },
        overflow: 'hidden',
        position: 'relative',
        minHeight: { xs: 300, sm: 360, md: 340 },
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: isDark ? brand.glowCyan : '0 12px 40px rgba(15,23,42,0.12)',
      }}
    >
      {/* Lifestyle photo */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${heroBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: { xs: '72% center', md: 'center' },
        }}
      />
      {/* Readable gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: {
            xs: `linear-gradient(180deg, rgba(5,10,24,0.92) 0%, rgba(5,10,24,0.75) 45%, rgba(5,10,24,0.88) 100%)`,
            md: `linear-gradient(90deg, rgba(5,10,24,0.95) 0%, rgba(5,10,24,0.78) 42%, rgba(5,10,24,0.25) 72%, rgba(5,10,24,0.15) 100%)`,
          },
        }}
      />
      {/* Accent glows */}
      <Box
        sx={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brand.cyan}33 0%, transparent 70%)`,
          top: -60,
          left: -40,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brand.magenta}28 0%, transparent 70%)`,
          bottom: -80,
          left: '30%',
          pointerEvents: 'none',
        }}
      />

      <Stack
        sx={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          minHeight: { xs: 300, sm: 360, md: 340 },
          p: { xs: 2.5, sm: 4, md: 5 },
          maxWidth: { md: '58%' },
          justifyContent: 'center',
        }}
        spacing={{ xs: 2, sm: 2.5 }}
      >
        <PlejkoLogo size={isMobile ? 'md' : 'lg'} showTagline color="#fff" />

        <Box>
          <Typography
            variant="h3"
            sx={{
              color: '#fff',
              fontWeight: 800,
              fontSize: { xs: '1.75rem', sm: '2.15rem', md: '2.4rem' },
              mb: 0.75,
            }}
          >
            Više od igre.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.82)',
              fontWeight: 600,
              fontSize: { xs: '1rem', sm: '1.15rem' },
            }}
          >
            Ljudi. Mečevi. Dobre priče.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {categories.map((c) => (
            <Chip
              key={c.label}
              icon={c.icon}
              label={c.label}
              variant="outlined"
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.35)',
                bgcolor: 'rgba(5,10,24,0.35)',
                backdropFilter: 'blur(6px)',
                '& .MuiChip-icon': { color: c.color },
              }}
            />
          ))}
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 0.5 }}>
          <Button
            component={RouterLink}
            to="/register"
            variant="contained"
            size="large"
            sx={{
              minWidth: 160,
              background: brand.gradient,
              boxShadow: brand.glowCyan,
            }}
          >
            Započni
          </Button>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            size="large"
            sx={{
              minWidth: 160,
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.55)',
              '&:hover': {
                borderColor: '#fff',
                bgcolor: 'rgba(255,255,255,0.08)',
              },
            }}
          >
            Prijavi se
          </Button>
        </Stack>

        {isMobile && (
          <PlejkoTagline sx={{ color: 'rgba(255,255,255,0.7)', justifyContent: 'flex-start' }} compact />
        )}
      </Stack>
    </Box>
  );
}
