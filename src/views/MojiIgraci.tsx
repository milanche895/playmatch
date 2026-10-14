'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate, Link } from '@/lib/router';
import api from '../lib/api';
import { User } from '../types';
import { getTrustBadge } from '../lib/reliability';
import StatusPill from '../components/ui/StatusPill';
import InviteToMatchSheet from '../components/InviteToMatchSheet';

interface Player {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  reliabilityScore?: number;
  /** Number of matches organised by the current user that this player joined. */
  matchesJoined: number;
}

/** Serbian plural for "zajednički meč": 1 → meč, 2–4 → meča, rest → mečeva (11–14 always many). */
function sharedMatchesLabel(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return `${n} zajednički meč`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} zajednička meča`;
  return `${n} zajedničkih mečeva`;
}

export default function MojiIgraci() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [blockedPlayers, setBlockedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [invitePlayer, setInvitePlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadPlayers();
    loadBlockedPlayers();
  }, []);

  async function loadPlayers() {
    try {
      setLoading(true);
      const res = await api.get('/api/players/my-players');
      setPlayers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju igrača');
    } finally {
      setLoading(false);
    }
  }

  async function loadBlockedPlayers() {
    try {
      const res = await api.get('/api/players/blocked-players');
      setBlockedPlayers(res.data.map((p: User) => p._id));
    } catch (err) {
      console.error('Error loading blocked players:', err);
    }
  }

  const visiblePlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Typography
        component="h1"
        sx={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F', lineHeight: 1.2 }}
      >
        Moji igrači
      </Typography>
      <Typography sx={{ fontSize: 17, color: '#6B7A99', mt: '6px', lineHeight: 1.4 }}>
        Ljudi koji su igrali na mečevima koje si ti napravio.
      </Typography>

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ mt: 2, borderRadius: '12px' }}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="30vh">
          <CircularProgress />
        </Box>
      ) : players.length === 0 ? (
        <Alert severity="info" sx={{ mt: 3, borderRadius: '12px' }}>
          Još nema igrača koji su se prijavili na tvoje mečeve.{' '}
          <Link to="/create" style={{ color: 'inherit', fontWeight: 600 }}>
            Napravi meč i pozovi igrače!
          </Link>
        </Alert>
      ) : (
        <>
          <TextField
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži igrače..."
            type="search"
            inputProps={{ 'aria-label': 'Pretraži igrače' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#5B6B8C' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mt: '20px',
              '& .MuiOutlinedInput-root': {
                height: 52,
                borderRadius: '14px',
                bgcolor: '#EDF2FA',
                fontSize: 16,
                '& fieldset': { borderColor: '#DCE5F2', borderWidth: '1px' },
                '&:hover fieldset': { borderColor: '#C3D0E6' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: '1.5px' },
              },
            }}
          />

          {visiblePlayers.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: '#6B7A99', mt: '32px', fontSize: 15 }}>
              Nema igrača za „{query.trim()}“.
            </Typography>
          ) : (
            <Stack spacing="10px" sx={{ mt: '16px' }}>
              {visiblePlayers.map((player) => {
                const badge = getTrustBadge(player.reliabilityScore);
                const blocked = blockedPlayers.includes(player._id);
                return (
                  <Box
                    key={player._id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/profil/${player._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/profil/${player._id}`);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      p: '10px 12px 10px 10px',
                      bgcolor: '#FFFFFF',
                      border: '1px solid #E3E9F3',
                      borderRadius: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar
                      src={player.avatarUrl}
                      alt={player.name}
                      sx={{ width: 60, height: 60, bgcolor: 'primary.main', fontSize: 26, fontWeight: 700, flexShrink: 0 }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 17, fontWeight: 800, color: '#0B1B3F', lineHeight: 1.3 }}>
                        {player.name}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 14, color: '#6B7A99', lineHeight: 1.4 }}>
                        {sharedMatchesLabel(player.matchesJoined)}
                      </Typography>
                      <Box sx={{ mt: '4px' }}>
                        {blocked ? (
                          <StatusPill tone="neutral" size="sm">
                            Blokiran
                          </StatusPill>
                        ) : (
                          <StatusPill
                            tone={badge.level}
                            size="sm"
                            withIcon
                            title={`Pouzdanost: ${player.reliabilityScore ?? 100}%`}
                          />
                        )}
                      </Box>
                    </Box>
                    <Button
                      disabled={blocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvitePlayer(player);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      sx={{
                        flexShrink: 0,
                        minWidth: 84,
                        height: 46,
                        borderRadius: '12px',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'primary.main',
                        bgcolor: '#E3EEFF',
                        '&:hover': { bgcolor: '#D4E5FF' },
                      }}
                    >
                      Pozovi
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          )}
        </>
      )}

      <InviteToMatchSheet
        open={invitePlayer !== null}
        onClose={() => setInvitePlayer(null)}
        playerId={invitePlayer?._id ?? ''}
        playerName={invitePlayer?.name ?? ''}
        onSent={() => setNotice(`Pozivnica je poslata igraču ${invitePlayer?.name ?? ''}.`.trim())}
      />
    </Box>
  );
}
