'use client';

import { useState, useEffect } from 'react';
import { 
  Stack, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  Divider, 
  Box,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { useNavigate, Link, useSearchParams, useLocation } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import PlejkoLogo from '../components/PlejkoLogo';

export default function Login() {
  const { user, login, loginWithGoogle, loginWithFacebook } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const redirectTo =
    (fromParam && fromParam.startsWith('/') && !fromParam.startsWith('//') ? fromParam : null) ||
    (location.state as { from?: string } | null)?.from ||
    '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (e) {
      setError('Neispravni podaci za prijavu');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    loginWithGoogle();
  }

  function handleFacebookLogin() {
    loginWithFacebook();
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
          maxWidth: 440,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          backgroundImage: `linear-gradient(180deg, rgba(0,212,255,0.06) 0%, transparent 35%)`,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Stack alignItems="center" sx={{ mb: 2 }}>
            <PlejkoLogo size="md" showTagline align="center" />
          </Stack>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Dobrodošli nazad
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Prijavite se da biste nastavili na Plejko
          </Typography>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3, borderRadius: 2 }}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <Stack spacing={3}>
            {/* Email Field */}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              placeholder="unesite@email.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Field */}
            <TextField
              label="Lozinka"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 20 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
              }}
            >
              {loading ? 'Prijava...' : 'Prijavi se'}
            </Button>
          </Stack>
        </form>

        {/* Divider */}
        <Box sx={{ my: 4, position: 'relative' }}>
          <Divider>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                px: 2,
              }}
            >
              ili nastavite sa
            </Typography>
          </Divider>
        </Box>

        {/* Social Login Buttons */}
        <Stack spacing={2}>
          <Button
            variant="outlined"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={loading}
            startIcon={<GoogleIcon />}
            sx={{
              py: 1.25,
              justifyContent: 'center',
            }}
          >
            Google
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleFacebookLogin}
            disabled={loading}
            startIcon={<FacebookIcon />}
            sx={{
              py: 1.25,
              justifyContent: 'center',
            }}
          >
            Facebook
          </Button>
        </Stack>

        {/* Sign up link */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nemate nalog?{' '}
            <Link 
              to="/register" 
              style={{ 
                color: 'inherit', 
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Box 
                component="span" 
                sx={{ 
                  color: 'primary.main',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Registrujte se
              </Box>
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
