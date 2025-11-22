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
      <Stack spacing={2} maxWidth={420}>
        <Typography variant="h5" fontWeight={600}>Prijava</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Lozinka" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" variant="contained">Prijavi se</Button>
        <Typography variant="body2">Nemate nalog? <Link to="/register">Registrujte se</Link></Typography>
      </Stack>
    </form>
  );
}


