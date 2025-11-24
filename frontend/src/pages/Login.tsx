import { useState } from 'react';
import { Stack, Typography, TextField, Button, Alert } from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (e) {
      setError('Neispravni podaci za prijavu');
    }
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
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: { xs: 1.25, sm: 1.5 },
            fontWeight: 600
          }}
        >
          Prijavi se
        </Button>
        <Typography 
          variant="body2" 
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, textAlign: 'center' }}
        >
          Nemate nalog? <Link to="/register" style={{ color: '#2e7d32', fontWeight: 600 }}>Registrujte se</Link>
        </Typography>
      </Stack>
    </form>
  );
}


