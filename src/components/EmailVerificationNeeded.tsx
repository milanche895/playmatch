'use client';

import { useState } from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function EmailVerificationNeeded({ email }: { email?: string }) {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setStatus('sending');
    setMessage(null);
    try {
      await api.post('/api/auth/resend-verification');
      setStatus('sent');
      setMessage('Novi link je poslat. Proveri sanduče i spam folder.');
    } catch (err: any) {
      const code = err.response?.data?.code;
      const serverMessage = err.response?.data?.message || '';
      if (code === 'EMAIL_ALREADY_VERIFIED' || serverMessage === 'Email je već potvrđen') {
        await refreshUser();
        return;
      }
      setStatus('error');
      setMessage(err.response?.data?.message || 'Slanje linka nije uspelo. Pokušaj ponovo.');
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'warning.main',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <MarkEmailUnreadIcon color="warning" />
          <Typography variant="h6" fontWeight={700}>
            Potvrdi email da kreiraš meč
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Možeš da se prijaviš na mečeve i bez potvrde, ali za kreiranje meča moraš da
          verifikuješ nalog. Pošalji link na{email ? ` ${email}` : ' svoj email'} i
          otvori ga iz sandučeta.
        </Typography>
        {message && (
          <Alert severity={status === 'error' ? 'error' : 'success'} sx={{ borderRadius: 2 }}>
            {message}
          </Alert>
        )}
        <Button
          variant="contained"
          onClick={resend}
          disabled={status === 'sending'}
          sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, borderRadius: 2, fontWeight: 700 }}
        >
          {status === 'sending' ? 'Šaljem...' : 'Pošalji link ponovo'}
        </Button>
      </Stack>
    </Paper>
  );
}
