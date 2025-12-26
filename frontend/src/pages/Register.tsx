import { useState } from 'react';
import { 
  Stack, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  FormControl, 
  FormLabel, 
  RadioGroup, 
  FormControlLabel, 
  Radio,
  Divider,
  Box
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleSelectionModal from '../components/RoleSelectionModal';

export default function Register() {
  const { register, loginWithGoogle, loginWithFacebook } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'player' | 'court'>('player');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'facebook' | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password, role);
      // Small delay to ensure cookie is set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/');
    } catch (e: any) {
      console.error('Registration error:', e);
      setError(e.response?.data?.message || 'Registracija nije uspela');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setPendingProvider('google');
    setRoleModalOpen(true);
  }

  function handleFacebookLogin() {
    setPendingProvider('facebook');
    setRoleModalOpen(true);
  }

  function handleRoleSelected(role: 'player' | 'court') {
    setRoleModalOpen(false);
    
    if (pendingProvider === 'google') {
      loginWithGoogle(role);
    } else if (pendingProvider === 'facebook') {
      handleFacebookLoginWithRole(role);
    }
    
    setPendingProvider(null);
  }

  function handleFacebookLoginWithRole(role: 'player' | 'court') {
    // Redirect to Facebook OAuth with role
    loginWithFacebook(role);
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack 
        spacing={{ xs: 2, sm: 2.5 }} 
        maxWidth={420}
        sx={{ width: '100%', mx: 'auto' }}
      >
        <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
          Registracija
        </Typography>
        {error && <Alert severity="error" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{error}</Alert>}
        <TextField 
          label="Ime" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }
          }}
        />
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
        
        <FormControl component="fieldset" sx={{ mt: { xs: 0, sm: 1 } }}>
          <FormLabel component="legend" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, mb: 1 }}>
            Ja sam:
          </FormLabel>
          <RadioGroup
            row
            value={role}
            onChange={(e) => setRole(e.target.value as 'player' | 'court')}
            sx={{ gap: { xs: 2, sm: 3 } }}
          >
            <FormControlLabel 
              value="player" 
              control={<Radio size="small" />} 
              label="Igrač"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            />
            <FormControlLabel 
              value="court" 
              control={<Radio size="small" />} 
              label="Teren"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            />
          </RadioGroup>
        </FormControl>
        
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
          Kreiraj nalog
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
            Registruj se sa Gmail-om
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
            Registruj se sa Facebook-om
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
            Registruj se sa Instagram-om
          </Button> */}
        </Stack>

        <Typography 
          variant="body2" 
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, textAlign: 'center', mt: 2 }}
        >
          Već imate nalog? <Link to="/login" style={{ color: '#2e7d32', fontWeight: 600 }}>Prijavite se</Link>
        </Typography>
      </Stack>

      {pendingProvider && (
        <RoleSelectionModal
          open={roleModalOpen}
          onClose={() => {
            setRoleModalOpen(false);
            setPendingProvider(null);
          }}
          onSelect={handleRoleSelected}
          provider={pendingProvider}
        />
      )}
    </form>
  );
}


