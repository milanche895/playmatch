'use client';

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNavigate } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import InstallButton from '../components/InstallButton';

/** Minimal court account so the owner can open notifications and sign out. */
export default function CourtAccount() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Profil
        </Typography>
        <InstallButton />
      </Stack>
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{user?.name}</Typography>
        {user?.email && (
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>{user.email}</Typography>
        )}
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>Vlasnik mesta</Typography>
      </Paper>
      <Stack spacing={1.5}>
        <Button
          variant="outlined"
          startIcon={<NotificationsNoneIcon />}
          onClick={() => navigate('/notification-settings')}
          sx={{ justifyContent: 'flex-start', borderRadius: 2, height: 48, fontWeight: 700 }}
        >
          Obaveštenja
        </Button>
        <Button
          color="error"
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={async () => {
            await logout();
            navigate('/');
          }}
          sx={{ justifyContent: 'flex-start', borderRadius: 2, height: 48, fontWeight: 700 }}
        >
          Odjavi se
        </Button>
      </Stack>
    </Box>
  );
}
