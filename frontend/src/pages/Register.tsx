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
      <Stack spacing={2} maxWidth={420}>
        <Typography variant="h5" fontWeight={600}>Registracija</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Ime" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Lozinka" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        
        <FormControl component="fieldset">
          <FormLabel component="legend">Ja sam:</FormLabel>
          <RadioGroup
            row
            value={role}
            onChange={(e) => setRole(e.target.value as 'player' | 'court')}
          >
            <FormControlLabel value="player" control={<Radio />} label="Igrač" />
            <FormControlLabel value="court" control={<Radio />} label="Teren" />
          </RadioGroup>
        </FormControl>
        
        <Button type="submit" variant="contained">Kreiraj nalog</Button>
        <Typography variant="body2">Već imate nalog? <Link to="/login">Prijavite se</Link></Typography>
      </Stack>
    </form>
  );
}


