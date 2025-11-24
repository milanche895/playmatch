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
  Radio 
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'player' | 'court'>('player');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(name, email, password, role);
      navigate('/');
    } catch (e) {
      setError('Registracija nije uspela');
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
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: { xs: 1.25, sm: 1.5 },
            fontWeight: 600
          }}
        >
          Kreiraj nalog
        </Button>
        <Typography 
          variant="body2" 
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, textAlign: 'center' }}
        >
          Već imate nalog? <Link to="/login" style={{ color: '#2e7d32', fontWeight: 600 }}>Prijavite se</Link>
        </Typography>
      </Stack>
    </form>
  );
}


