import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { markPromptNotificationsAfterRegister } from '../components/PostRegisterNotificationDialog';
import api from '../lib/api';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  useEffect(() => {
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');
    const isNewUser = searchParams.get('newUser') === '1';

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (isNewUser) {
      markPromptNotificationsAfterRegister();
    }

    // Set user immediately from URL param for instant UI feedback
    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        setUser(userData);
      } catch {}
    }

    // Verify auth using the HttpOnly cookie set during OAuth redirect
    api.get('/api/auth/me')
      .then((res) => {
        if (res.data) setUser(res.data);
        navigate('/', { state: { promptNotifications: isNewUser && res.data?.role === 'player' } });
      })
      .catch(() => {
        navigate('/login?error=auth_verification_failed');
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
