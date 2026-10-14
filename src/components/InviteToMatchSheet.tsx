'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, ButtonBase, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioOffIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useNavigate } from '@/lib/router';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Match } from '../types';
import { getGameTypeName } from '../constants/games';
import { getCreditsDisplay } from '../lib/gamification';
import BottomSheet from './BottomSheet';
import SportIcon from './SportIcon';

type InviteToMatchSheetProps = {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  /** Called after the invitation was sent successfully. */
  onSent?: () => void;
};

function formatMatchTime(dateTime: string): string {
  return new Date(dateTime).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getMatchLocationName(match: Match): string {
  if (match.isInformal) return match.informalLocation?.name || 'Privatni teren';
  if (typeof match.fieldId === 'object' && match.fieldId?.name) return match.fieldId.name;
  return 'Nepoznat teren';
}

/**
 * Bottom sheet: pick one of your own open matches and send a direct invite (costs 1 credit)
 * to a single player via POST /api/matches/:id/invite-players.
 */
export default function InviteToMatchSheet({ open, onClose, playerId, playerName, onSent }: InviteToMatchSheetProps) {
  const navigate = useNavigate();
  const { user: currentUser, refreshUser } = useAuth();
  const [myMatches, setMyMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setSelectedMatchId(null);
    setLoading(true);
    api
      .get('/api/players/my-matches/created')
      .then((res) => {
        if (!cancelled) setMyMatches(res.data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setMyMatches([]);
        setError(err.response?.data?.message || 'Greška pri učitavanju tvojih mečeva');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Matches the current user organizes that can still receive this player
  const invitableMatches = useMemo(() => {
    if (!myMatches) return [];
    const now = Date.now();
    return myMatches.filter(
      (m) =>
        (m.status === 'open' || m.status === 'full') &&
        new Date(m.registrationDeadline).getTime() > now &&
        new Date(m.dateTime).getTime() > now &&
        !m.players.some((p) => (typeof p === 'string' ? p : p._id) === playerId)
    );
  }, [myMatches, playerId]);

  async function handleSend() {
    if (!selectedMatchId) return;
    try {
      setSending(true);
      setError(null);
      await api.post(`/api/matches/${selectedMatchId}/invite-players`, { playerIds: [playerId] });
      onClose();
      refreshUser?.();
      onSent?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri slanju pozivnice');
    } finally {
      setSending(false);
    }
  }

  const firstName = playerName.split(' ')[0];
  const credits = getCreditsDisplay(currentUser?.credits);

  return (
    <BottomSheet open={open} onClose={() => !sending && onClose()} title="Pozovi na meč">
      <Typography sx={{ fontSize: 14.5, color: '#6B7A99', mb: '14px' }}>
        Izaberi svoj meč na koji pozivaš igrača {firstName}. Pozivnica košta 1 kredit (imaš {credits}).
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={28} />
        </Box>
      ) : invitableMatches.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: '8px' }}>
          <Typography sx={{ fontSize: 15, color: '#6B7A99', mb: '14px' }}>
            Nemaš otvorenih mečeva na koje možeš pozvati ovog igrača.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={() => {
              onClose();
              navigate('/create');
            }}
            sx={{ height: 48, borderRadius: '12px', fontWeight: 700 }}
          >
            Kreiraj meč
          </Button>
        </Box>
      ) : (
        <>
          <Stack spacing="8px" sx={{ mb: '16px', maxHeight: '45vh', overflowY: 'auto' }}>
            {invitableMatches.map((m) => {
              const selected = selectedMatchId === m._id;
              return (
                <ButtonBase
                  key={m._id}
                  onClick={() => setSelectedMatchId(m._id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '12px',
                    textAlign: 'left',
                    width: '100%',
                    px: '14px',
                    py: '12px',
                    borderRadius: '14px',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : '#E3E9F3',
                    bgcolor: selected ? '#EEF5FF' : '#FFFFFF',
                  }}
                >
                  <SportIcon sport={m.sport} size={32} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, color: '#0B1B3F' }}>
                      {getGameTypeName(m.sport)}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 13.5, color: '#6B7A99' }}>
                      {formatMatchTime(m.dateTime)} · {getMatchLocationName(m)}
                    </Typography>
                  </Box>
                  {selected ? (
                    <CheckCircleIcon sx={{ color: 'primary.main' }} />
                  ) : (
                    <RadioOffIcon sx={{ color: '#B5C0D6' }} />
                  )}
                </ButtonBase>
              );
            })}
          </Stack>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleSend}
            disabled={!selectedMatchId || sending}
            sx={{ height: 52, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
          >
            {sending ? 'Slanje...' : 'Pošalji pozivnicu'}
          </Button>
        </>
      )}
    </BottomSheet>
  );
}
