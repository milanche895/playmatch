'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate, useSearchParams } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import EmailVerificationNeeded from '../components/EmailVerificationNeeded';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'missing'>(
    token ? 'verifying' : 'missing'
  );
  const [message, setMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (user?.emailVerified) {
      setStatus('success');
    }
  }, [user?.emailVerified]);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;

    if (user?.emailVerified) {
      setStatus('success');
      return;
    }

    api.post('/api/auth/verify-email', { token })
      .then((res) => {
        setUser(res.data);
        setStatus('success');
      })
      .catch(async (err) => {
        try {
          const me = await api.get('/api/auth/me');
          if (me.data?.emailVerified) {
            setUser(me.data);
            setStatus('success');
            return;
          }
        } catch {
          // fall through to the original error
        }
        setStatus('error');
        setMessage(err.response?.data?.message || 'Link je nevažeći ili je istekao');
      });
  }, [token, setUser, user?.emailVerified]);

  if (status === 'verifying') {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="40vh" gap={2}>
        <CircularProgress />
        <Typography>Potvrđujemo email...</Typography>
      </Box>
    );
  }

  if (status === 'success') {
    return (
      <Paper elevation={0} sx={{ maxWidth: 520, mx: 'auto', p: 3, borderRadius: 3, border: '1px solid', borderColor: 'success.light' }}>
        <Stack spacing={2} alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="h6" fontWeight={700}>Email je potvrđen</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Sada možeš da kreiraš mečeve.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/create')} sx={{ borderRadius: 2, fontWeight: 700 }}>
            Kreiraj meč
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Stack spacing={2}>
        <Alert severity={status === 'missing' ? 'info' : 'error'} sx={{ borderRadius: 2 }}>
          {message || 'Otvori link iz emaila da potvrdiš nalog.'}
        </Alert>
        {user && !user.emailVerified && (!user.provider || user.provider === 'local') && (
          <EmailVerificationNeeded email={user.email} />
        )}
        <Button variant="outlined" onClick={() => navigate('/')} sx={{ alignSelf: 'flex-start', borderRadius: 2 }}>
          Nazad na početnu
        </Button>
      </Stack>
    </Box>
  );
}
