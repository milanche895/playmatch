'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Button, ButtonBase, CircularProgress, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useNavigate, Link } from '@/lib/router';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Match } from '../types';
import { getGameTypeName } from '../constants/games';
import SportIcon from '../components/SportIcon';
import SegmentedControl from '../components/ui/SegmentedControl';

type Role = 'created' | 'joined';
type StatusTab = 'active' | 'completed' | 'cancelled';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'active', label: 'Aktivni' },
  { value: 'completed', label: 'Završeni' },
  { value: 'cancelled', label: 'Otkazani' },
];

function matchStatusTab(match: Match): StatusTab {
  if (match.status === 'completed') return 'completed';
  if (match.status === 'otkazano' || match.status === 'failed') return 'cancelled';
  return 'active';
}

function formatRelativeMatchTime(dateTime: string): string {
  const matchDate = new Date(dateTime);
  const timeStr = matchDate.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', hour12: false });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
  const dayDiff = Math.round((startOfMatchDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return `Danas · ${timeStr}`;
  if (dayDiff === 1) return `Sutra · ${timeStr}`;
  if (dayDiff === -1) return `Juče · ${timeStr}`;
  return `${matchDate.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' })} · ${timeStr}`;
}

function getMatchLocationName(match: Match): string {
  if (match.isInformal) return match.informalLocation?.name || 'Privatni teren';
  if (typeof match.fieldId === 'object' && match.fieldId?.name) return match.fieldId.name;
  return 'Nepoznat teren';
}

function formatPlayersProgress(match: Match): string {
  const target = match.maxPlayers ?? match.minPlayers ?? match.playersNeeded;
  return `${match.players.length}/${target}`;
}

function canShowConfirmMatchButton(match: Match): boolean {
  const inProgress = match.status === 'open' || match.status === 'full';
  return Boolean(match.isInformal && inProgress && new Date() > new Date(match.dateTime));
}

function idOf(ref: string | { _id: string } | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : String(ref._id);
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing="10px"
      sx={{ mt: '12px', px: '12px', py: '10px', borderRadius: '10px', bgcolor: '#FFF5DB', color: '#B4540A' }}
    >
      <Box sx={{ display: 'flex', flexShrink: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}>{icon}</Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{children}</Typography>
    </Stack>
  );
}

export default function MojiMecevi() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [role, setRole] = useState<Role>('created');
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  const [createdMatches, setCreatedMatches] = useState<Match[]>([]);
  const [joinedMatches, setJoinedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      setLoading(true);
      const [createdRes, joinedRes] = await Promise.all([
        api.get('/api/players/my-matches/created'),
        api.get('/api/players/my-matches/joined'),
      ]);
      setCreatedMatches(createdRes.data);
      setJoinedMatches(joinedRes.data);
    } catch (err: any) {
      console.error('Matches loading error:', err);
    } finally {
      setLoading(false);
    }
  }

  const visibleMatches = useMemo(() => {
    const source = role === 'created' ? createdMatches : joinedMatches;
    const filtered = source.filter((m) => matchStatusTab(m) === statusTab);
    // Upcoming first for active, most recent first for the rest
    return [...filtered].sort((a, b) =>
      statusTab === 'active'
        ? new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
        : new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
    );
  }, [role, statusTab, createdMatches, joinedMatches]);

  function getNote(match: Match): ReactNode | null {
    const myId = currentUser?._id;
    if (match.status === 'completed' && myId && match.players.length > 1) {
      const alreadyRated = (match.ratings || []).some((r) => idOf(r.raterId) === myId);
      if (!alreadyRated) {
        return <Note icon={<StarBorderIcon />}>Treba da oceniš saigrače.</Note>;
      }
    }
    if (match.courtApproval === 'pending' && (match.status === 'open' || match.status === 'full')) {
      return <Note icon={<HourglassEmptyIcon />}>Vlasnik još nije potvrdio termin.</Note>;
    }
    return null;
  }

  function renderEmpty() {
    const text =
      statusTab === 'active'
        ? role === 'created'
          ? 'Još nisi okupio nijedan aktivan meč.'
          : 'Nisi prijavljen ni na jedan aktivan meč.'
        : statusTab === 'completed'
          ? 'Još nema završenih mečeva.'
          : 'Nema otkazanih mečeva.';
    const showLink = statusTab === 'active';
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <Typography sx={{ fontSize: 15, color: '#6B7A99' }}>{text}</Typography>
        {showLink && (
          <Button
            component={Link}
            to={role === 'created' ? '/create' : '/'}
            sx={{ mt: 1, fontWeight: 700, borderRadius: '12px' }}
          >
            {role === 'created' ? 'Napravi prvi meč' : 'Pronađi mečeve u blizini'}
          </Button>
        )}
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: '16px' }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F' }}>
          Moji mečevi
        </Typography>
        {!isMobile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            to="/create"
            sx={{ borderRadius: '12px', fontWeight: 700 }}
          >
            Kreiraj meč
          </Button>
        )}
      </Stack>

      <SegmentedControl<Role>
        value={role}
        onChange={setRole}
        options={[
          { value: 'created', label: 'Ja sam okupio' },
          { value: 'joined', label: 'Prijavio sam se' },
        ]}
      />

      <Stack direction="row" spacing="8px" sx={{ mt: '12px', mb: '16px' }}>
        {STATUS_TABS.map((t) => {
          const selected = t.value === statusTab;
          return (
            <ButtonBase
              key={t.value}
              aria-pressed={selected}
              onClick={() => setStatusTab(t.value)}
              sx={{
                flex: 1,
                height: 38,
                borderRadius: '19px',
                fontSize: 14.5,
                fontWeight: 600,
                color: selected ? '#FFFFFF' : '#0B1B3F',
                bgcolor: selected ? 'primary.main' : '#FFFFFF',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : '#DCE5F2',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              {t.label}
            </ButtonBase>
          );
        })}
      </Stack>

      {visibleMatches.length === 0 ? (
        renderEmpty()
      ) : (
        <Stack spacing="12px">
          {visibleMatches.map((match) => {
            const detailsPath = `/matches/${match._id}`;
            const note = getNote(match);
            const showConfirm = role === 'created' && canShowConfirmMatchButton(match);
            return (
              <Box
                key={match._id}
                sx={{ bgcolor: '#FFFFFF', border: '1px solid #E3E9F3', borderRadius: '16px', p: '16px' }}
              >
                <ButtonBase
                  component="div"
                  onClick={() => navigate(detailsPath)}
                  aria-label={`${getGameTypeName(match.sport)} — ${getMatchLocationName(match)}`}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    gap: '12px',
                  }}
                >
                  <SportIcon sport={match.sport} size={46} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: '#0B1B3F' }}>
                      {getGameTypeName(match.sport)}
                    </Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: '#0B1B3F' }}>
                      {formatRelativeMatchTime(match.dateTime)}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 14, lineHeight: 1.4, color: '#6B7A99' }}>
                      {getMatchLocationName(match)} · {formatPlayersProgress(match)}
                    </Typography>
                  </Box>
                  <ChevronRightIcon sx={{ color: '#6B7A99', flexShrink: 0 }} />
                </ButtonBase>

                {note}

                {showConfirm && (
                  <Button
                    variant="contained"
                    color="success"
                    component={Link}
                    to={`/matches/${match._id}?confirmMatch=1`}
                    fullWidth
                    sx={{ mt: '12px', borderRadius: '11px', fontWeight: 600, height: 40 }}
                  >
                    Potvrdi meč
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
