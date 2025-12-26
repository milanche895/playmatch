import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      // Redirect to login with error
      navigate(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token && userParam) {
      try {
        // Save token to localStorage
        localStorage.setItem('token', token);
        
        // Parse user data
        const userData = JSON.parse(decodeURIComponent(userParam));
        setUser(userData);

        // Verify authentication by calling /me endpoint
        api.get('/api/auth/me')
          .then((res) => {
            if (res.data) {
              setUser(res.data);
            }
            navigate('/');
          })
          .catch((err) => {
            console.error('Auth verification error:', err);
            navigate('/login?error=auth_verification_failed');
          });
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login?error=invalid_callback_data');
      }
    } else {
      navigate('/login?error=missing_callback_data');
    }
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
