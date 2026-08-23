'use client';

import { useEffect } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import PlejkoLogo from '../components/PlejkoLogo';
import { getGameTypeName } from '../constants/games';
import { markPromptNotificationsAfterRegister } from '../components/PostRegisterNotificationDialog';
import SportsIcon from '@mui/icons-material/Sports';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export default function Welcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/register', { replace: true });
    }
    if (user && user.role !== 'court') {
      markPromptNotificationsAfterRegister();
    }
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  const isCourt = user.role === 'court';
  const games = user.preferredSports || [];

  function goHome() {
    if (!isCourt) {
      markPromptNotificationsAfterRegister();
    }
    navigate('/', {
      replace: true,
      state: { promptNotifications: !isCourt },
    });
  }

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 560,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          backgroundImage: `linear-gradient(180deg, rgba(0,212,255,0.08) 0%, transparent 40%)`,
        }}
      >
        <Stack alignItems="center" spacing={2.5}>
          <PlejkoLogo size="lg" showTagline align="center" />
          <Typography variant="h4" fontWeight={800}>
            Dobrodošao/la u Plejko
            {user.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
            {isCourt
              ? 'Tvoje mesto je spremno za igrače. Dodaj teren ili lokal i počni da primaš rezervacije.'
              : 'Pronađi mečeve u blizini, okupi ekipu i igraj. Sve što si izabrao čeka te na početnoj.'}
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 2,
              py: 1,
              borderRadius: 999,
              bgcolor: 'action.hover',
            }}
          >
            {isCourt ? <LocationOnIcon fontSize="small" /> : <SportsIcon fontSize="small" />}
            <Typography variant="body2" fontWeight={700}>
              {isCourt ? 'Teren' : 'Igrač'}
            </Typography>
          </Stack>

          {games.length > 0 && (
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {isCourt ? 'Igre koje nudiš' : 'Tvoje igre'}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  justifyContent: 'center',
                  mt: 1,
                }}
              >
                {games.map((id) => (
                  <Chip key={id} label={getGameTypeName(id)} size="small" color="secondary" />
                ))}
              </Box>
            </Box>
          )}

          {user.provider === 'local' && !user.emailVerified && (
            <Typography variant="body2" color="text.secondary">
              Poslali smo ti link za potvrdu emaila — proveri inbox.
            </Typography>
          )}

          {isCourt ? (
            <>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={goHome}
                sx={{ py: 1.5, fontSize: '1rem', mt: 1 }}
              >
                Idi na početnu
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={() => navigate('/manage-fields', { replace: true })}
              >
                Dodaj svoje mesto
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => {
                  markPromptNotificationsAfterRegister();
                  navigate('/create', { replace: true });
                }}
                sx={{ py: 1.5, fontSize: '1rem', mt: 1 }}
              >
                Kreiraj prvi meč
              </Button>
              <Button variant="outlined" size="large" fullWidth onClick={goHome}>
                Idi na početnu
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
