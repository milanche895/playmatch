import { useState, useEffect } from 'react';
import { Stack, Typography, TextField, Button, Alert, Divider, Box } from '@mui/material';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for error in URL params
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
      navigate('/');
    } catch (e) {
      setError('Neispravni podaci za prijavu');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    // For login, don't ask for role - just redirect
    loginWithGoogle();
  }

  function handleFacebookLogin() {
    // For login, don't ask for role - just redirect
    loginWithFacebook();
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack 
        spacing={{ xs: 2, sm: 2.5 }} 
        maxWidth={420}
        sx={{ width: '100%', mx: 'auto' }}
      >
        <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
          Prijava
        </Typography>
        {error && <Alert severity="error" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{error}</Alert>}
        <TextField 
          label="Email" 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }
          }}
        />
        <TextField 
          label="Lozinka" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }
          }}
        />
        <Button 
          type="submit" 
          variant="contained" 
          fullWidth
          size="large"
          disabled={loading}
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: { xs: 1.25, sm: 1.5 },
            fontWeight: 600
          }}
        >
          Prijavi se
        </Button>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ili
          </Typography>
        </Divider>

        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{
              py: 1.25,
              borderColor: '#db4437',
              color: '#db4437',
              '&:hover': {
                borderColor: '#c23321',
                backgroundColor: 'rgba(219, 68, 55, 0.04)'
              }
            }}
          >
            <Box component="span" sx={{ mr: 1, fontSize: '1.2rem' }}>🔴</Box>
            Prijavi se sa Gmail-om
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleFacebookLogin}
            disabled={loading}
            sx={{
              py: 1.25,
              borderColor: '#1877f2',
              color: '#1877f2',
              '&:hover': {
                borderColor: '#166fe5',
                backgroundColor: 'rgba(24, 119, 242, 0.04)'
              }
            }}
          >
            <Box component="span" sx={{ mr: 1, fontSize: '1.2rem' }}>📘</Box>
            Prijavi se sa Facebook-om
          </Button>

          {/* Instagram login disabled - requires HTTPS and Facebook SDK */}
          {/* <Button
            variant="outlined"
            fullWidth
            onClick={handleInstagramLogin}
            disabled={loading}
            sx={{
              py: 1.25,
              borderColor: '#E4405F',
              color: '#E4405F',
              '&:hover': {
                borderColor: '#C13584',
                backgroundColor: 'rgba(228, 64, 95, 0.04)'
              }
            }}
          >
            <Box component="span" sx={{ mr: 1, fontSize: '1.2rem' }}>📷</Box>
            Prijavi se sa Instagram-om
          </Button> */}
        </Stack>

        <Typography 
          variant="body2" 
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, textAlign: 'center', mt: 2 }}
        >
          Nemate nalog? <Link to="/register" style={{ color: '#2e7d32', fontWeight: 600 }}>Registrujte se</Link>
        </Typography>
      </Stack>
    </form>
  );
}


