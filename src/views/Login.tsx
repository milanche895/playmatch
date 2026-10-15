'use client';

import { useState, useEffect } from 'react';
import { Stack, Typography, Button, Alert, Box } from '@mui/material';
import { useNavigate, Link, useSearchParams, useLocation } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import FacebookIcon from '@mui/icons-material/Facebook';
import {
  AuthShell,
  AuthField,
  SocialButton,
  OrDivider,
  GoogleColorIcon,
  AUTH_CONTROL_HEIGHT,
} from '../components/auth/AuthParts';

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
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

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <AuthShell
      title="Dobro došao nazad"
      subtitle="Uloguj se na svoj Plejko nalog."
      onBack={handleBack}
      footer={
        <Typography sx={{ fontSize: 15, color: 'text.secondary', fontWeight: 400 }}>
          Nemaš nalog?{' '}
          <Box
            component={Link}
            to="/register"
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Registruj se
          </Box>
        </Typography>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: '18px', borderRadius: '12px' }}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="info" sx={{ mb: '18px', borderRadius: '12px' }}>
          {notice}
        </Alert>
      )}

      <form onSubmit={onSubmit}>
        <Stack spacing="18px">
          <AuthField
            label="Email adresa"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Unesi email adresu"
            icon={<EmailOutlinedIcon sx={{ fontSize: 22 }} />}
          />
          <AuthField
            label="Lozinka"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Unesi lozinku"
            icon={<LockOutlinedIcon sx={{ fontSize: 22 }} />}
            passwordToggle
          />
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: '14px' }}>
          <Box
            component="button"
            type="button"
            onClick={() =>
              setNotice(
                'Resetovanje lozinke uskoro stiže. Do tada se možeš prijaviti preko Google ili Facebook naloga.',
              )
            }
            sx={{
              p: 0,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Zaboravio si lozinku?
          </Box>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{
            mt: '28px',
            height: AUTH_CONTROL_HEIGHT,
            borderRadius: '14px',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {loading ? 'Prijava...' : 'Uloguj se'}
        </Button>
      </form>

      <OrDivider />

      <Stack spacing="14px">
        <SocialButton
          icon={<GoogleColorIcon />}
          onClick={() => loginWithGoogle()}
          disabled={loading}
        >
          Nastavi sa Google nalogom
        </SocialButton>
        <SocialButton
          icon={<FacebookIcon sx={{ color: '#1877F2', fontSize: 24 }} />}
          onClick={() => loginWithFacebook()}
          disabled={loading}
        >
          Nastavi sa Facebook nalogom
        </SocialButton>
      </Stack>
    </AuthShell>
  );
}
