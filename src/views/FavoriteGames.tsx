'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useGoBack } from '@/lib/router';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PreferredGamesPicker from '../components/PreferredGamesPicker';

export default function FavoriteGames() {
  const goBack = useGoBack();
  const { user, refreshUser } = useAuth();
  const [games, setGames] = useState<string[]>(user?.preferredSports || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setGames(user?.preferredSports || []);
  }, [user?._id, user?.preferredSports]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await api.put('/api/players/profile', { preferredSports: games });
      await refreshUser();
      setSuccess(games.length > 0 ? 'Omiljene igre su sačuvane.' : 'Lista omiljenih igara je obrisana.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri čuvanju omiljenih igara');
    } finally {
      setSaving(false);
    }
  }

  const unchanged =
    games.length === (user?.preferredSports || []).length &&
    games.every((id, index) => id === user?.preferredSports?.[index]);

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 }, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing="6px" sx={{ mb: '14px' }}>
        <IconButton
          aria-label="Nazad"
          onClick={() => goBack('/profil')}
          edge="start"
          sx={{ color: '#0B1B3F' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography component="h1" sx={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F' }}>
          Omiljene igre
        </Typography>
      </Stack>

      <Typography sx={{ fontSize: 15, color: '#6B7A99', lineHeight: 1.45, mb: '16px' }}>
        Ove igre koristimo za obaveštenja o novim mečevima i za kreiranje meča. Prijavu ovo ne
        ograničava — možeš da se prijaviš i na igru koja ti nije ovde.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '16px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '16px' }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <PreferredGamesPicker value={games} onChange={setGames} disabled={saving} />

      {games.length === 0 && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: '16px' }}>
          Bez omiljenih igara ne možeš da kreiraš meč, a obaveštenja o novim mečevima stižu samo ako
          u postavkama uključiš „Sve“.
        </Alert>
      )}

      <Button
        fullWidth
        variant="contained"
        onClick={handleSave}
        disabled={saving || unchanged}
        sx={{ mt: '20px', height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
      >
        {saving ? 'Čuvanje...' : 'Sačuvaj'}
      </Button>
    </Box>
  );
}
