'use client';

import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from '@/lib/router';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { mergeAuthUser } from '../lib/emailVerified';
import api from '../lib/api';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const error = searchParams.get('error');
    const isNewUser = searchParams.get('newUser') === '1';

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    // Verify auth using the HttpOnly cookie set during OAuth redirect
    api.get('/api/auth/me')
      .then((res) => {
        if (res.data) setUser((prev) => mergeAuthUser(prev, res.data));
        navigate(isNewUser ? '/welcome' : '/', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=auth_verification_failed', { replace: true });
      });
  }, [searchParams, navigate, setUser]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="50vh"
      gap={2}
    >
      <CircularProgress />
      <Typography variant="body1">Prijavljivanje...</Typography>
    </Box>
  );
}
