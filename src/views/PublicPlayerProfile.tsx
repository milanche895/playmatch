'use client';

import { useState, useEffect, type ElementType, type ReactNode } from 'react';
import { useParams, useNavigate } from '@/lib/router';
import {
  Box,
  Button,
  ButtonBase,
  Typography,
  Stack,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreIcon,
  PlaceOutlined as PlaceIcon,
  Star as StarIcon,
  Block as BlockIcon,
  PersonAddAlt1 as PersonAddIcon,
  EventAvailableOutlined as CommonMatchesIcon,
  ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { User, PlayerAnalytics } from '../types';
import { getTrustBadge } from '../lib/reliability';
import { getGameTypeName } from '../constants/games';
import BottomSheet from '../components/BottomSheet';
import InviteToMatchSheet from '../components/InviteToMatchSheet';
import SportIcon from '../components/SportIcon';
import StatusPill from '../components/ui/StatusPill';

interface CommonMatch {
  _id: string;
  sport: string;
  dateTime: string;
  fieldName: string;
}

const experienceLabels: Record<string, string> = {
  beginner: 'Početnik',
  intermediate: 'Srednji',
  advanced: 'Napredni',
  professional: 'Profesionalac',
};

/** Level words shown under a sport, by per-sport skill level (1–5) or by overall experience. */
const SKILL_LEVEL_WORDS: Record<number, string> = {
  1: 'početnik',
  2: 'rekreativac',
  3: 'srednji',
  4: 'napredni',
  5: 'profesionalac',
};
const EXPERIENCE_WORDS: Record<string, string> = {
  beginner: 'početnik',
  intermediate: 'srednji',
  advanced: 'napredni',
  professional: 'profesionalac',
};

type SheetKey = 'invite' | 'block' | 'details' | 'common' | null;

function formatRating(value?: number): string {
  return Number(value || 0).toFixed(1).replace('.', ',');
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function MenuRow({
  icon: Icon,
  label,
  detail,
  onClick,
  danger = false,
  last = false,
}: {
  icon: ElementType;
  label: string;
  detail?: string;
  onClick: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '14px',
        px: '16px',
        height: 54,
        textAlign: 'left',
        borderBottom: last ? 'none' : '1px solid #EEF2F8',
        color: danger ? '#D92D20' : '#0B1B3F',
      }}
    >
      <Icon sx={{ fontSize: 24, color: danger ? '#D92D20' : '#5B6B8C' }} />
      <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 500, color: 'inherit' }}>{label}</Typography>
      {detail && <Typography sx={{ fontSize: 14, color: '#6B7A99' }}>{detail}</Typography>}
      <ChevronRightIcon sx={{ color: danger ? '#D92D20' : '#9AA6BF' }} />
    </ButtonBase>
  );
}

export default function PublicPlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const [sheet, setSheet] = useState<SheetKey>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  /** Matches organised by the viewer in which this player took part; null = not loaded / unavailable. */
  const [commonMatches, setCommonMatches] = useState<CommonMatch[] | null>(null);

  const isSelf = Boolean(currentUser && id && currentUser._id === id);
  const canAct = Boolean(currentUser && currentUser.role === 'player' && !isSelf);

  useEffect(() => {
    if (!id) return;
    loadProfile(id);
  }, [id]);

  useEffect(() => {
    if (!id || !canAct) return;
    api
      .get('/api/players/blocked-players')
      .then((res) => setIsBlocked((res.data as User[]).some((p) => p._id === id)))
      .catch((err) => console.error('Error loading blocked players:', err));
    api
      .get('/api/players/my-players')
      .then((res) => {
        const entry = (res.data as { _id: string; matches?: CommonMatch[] }[]).find((p) => p._id === id);
        setCommonMatches(entry?.matches ?? []);
      })
      .catch((err) => console.error('Error loading common matches:', err));
  }, [id, canAct]);

  async function loadProfile(playerId: string) {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, analyticsRes] = await Promise.all([
        api.get(`/api/players/profile/${playerId}`),
        api.get(`/api/players/analytics/${playerId}`),
      ]);
      setUser(profileRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju profila');
    } finally {
      setLoading(false);
    }
  }

  async function handleBlockToggle() {
    if (!id) return;
    try {
      setBlockLoading(true);
      if (isBlocked) {
        await api.delete(`/api/players/block-player/${id}`);
        setIsBlocked(false);
        setNotice({ severity: 'success', text: 'Igrač je odblokiran.' });
      } else {
        await api.post(`/api/players/block-player/${id}`);
        setIsBlocked(true);
        setNotice({ severity: 'success', text: 'Igrač je blokiran.' });
      }
      setSheet(null);
    } catch (err: any) {
      setSheet(null);
      setNotice({
        severity: 'error',
        text: err.response?.data?.message || (isBlocked ? 'Greška pri odblokiranju igrača' : 'Greška pri blokiranju igrača'),
      });
    } finally {
      setBlockLoading(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 } }}>
        <Alert severity="error" sx={{ borderRadius: '12px' }}>
          {error || 'Korisnik nije pronađen'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Nazad
        </Button>
      </Box>
    );
  }

  const badge = analytics ? getTrustBadge(analytics.reliabilityScore) : null;
  const hasRatings = (user.ratingsCount ?? 0) > 0 || Number(user.ratingAvg || 0) > 0;
  const commonCount = commonMatches?.length;
  // Preferred sports plus any sport the player has a skill level for
  const gameSports = [
    ...new Set([...(user.preferredSports ?? []), ...(user.sportSkillLevels ?? []).map((s) => s.sport)]),
  ];

  const statCells: { value: ReactNode; label: string }[] = [
    ...(canAct && commonCount !== undefined ? [{ value: commonCount, label: 'Zajedničkih mečeva' }] : []),
    { value: analytics ? analytics.totalReserved : '–', label: 'Ukupno mečeva' },
    {
      value: hasRatings ? (
        <>
          <StarIcon sx={{ fontSize: 24, color: '#F5B301' }} />
          {formatRating(user.ratingAvg)}
        </>
      ) : (
        '–'
      ),
      label: 'Prosečna ocena',
    },
  ];

  const sectionTitleSx = { fontSize: 17, fontWeight: 800, color: '#0B1B3F', mt: '22px', mb: '10px' };

  const detailRow = (label: string, value: ReactNode, last = false) => (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ py: '12px', borderBottom: last ? 'none' : '1px solid #EEF2F8' }}
    >
      <Typography sx={{ fontSize: 15, color: '#6B7A99' }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#0B1B3F' }}>{value}</Typography>
    </Stack>
  );

  /** Level word under a sport card (per-sport skill if known, else overall experience). */
  const levelFor = (sport: string): string | undefined => {
    const entry = user.sportSkillLevels?.find((s) => s.sport === sport);
    if (entry) return SKILL_LEVEL_WORDS[entry.skillLevel];
    return user.experience ? EXPERIENCE_WORDS[user.experience] : undefined;
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      {/* Top bar */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: '4px' }}>
        <IconButton aria-label="Nazad" onClick={() => navigate(-1)} edge="start" sx={{ color: '#0B1B3F' }}>
          <ArrowBackIcon />
        </IconButton>
        <IconButton aria-label="Više opcija" onClick={() => setSheet('details')} edge="end" sx={{ color: '#0B1B3F' }}>
          <MoreIcon />
        </IconButton>
      </Stack>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2, borderRadius: '12px' }}>
          {notice.text}
        </Alert>
      )}

      {/* Header: avatar, name, location, trust pill */}
      <Box sx={{ textAlign: 'center' }}>
        <Avatar
          src={user.avatarUrl}
          alt={user.name}
          sx={{
            width: 124,
            height: 124,
            mx: 'auto',
            bgcolor: 'primary.main',
            fontSize: 50,
            fontWeight: 700,
            border: '3px solid #FFFFFF',
            boxShadow: '0 4px 14px rgba(11, 27, 63, 0.14)',
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </Avatar>
        <Typography
          component="h1"
          sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F', lineHeight: 1.2, mt: '14px' }}
        >
          {user.name}
        </Typography>
        {user.location && (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing="4px" sx={{ mt: '4px', color: '#6B7A99' }}>
            <PlaceIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: 15 }}>{user.location}</Typography>
          </Stack>
        )}
        {badge && analytics && (
          <Box sx={{ mt: '10px' }}>
            <StatusPill tone={badge.level} withIcon title={`${badge.label} (${analytics.reliabilityScore}%)`}>
              {badge.level === 'reliable' ? 'Pouzdan' : badge.level === 'caution' ? 'Zna da otkaže' : 'Rizičan'} ·{' '}
              {analytics.reliabilityScore}/100
            </StatusPill>
          </Box>
        )}
      </Box>

      {/* Stats card */}
      <Stack
        direction="row"
        sx={{ mt: '20px', py: '14px', bgcolor: '#FFFFFF', border: '1px solid #E3E9F3', borderRadius: '16px' }}
      >
        {statCells.map((cell, index) => (
          <Box
            key={cell.label}
            sx={{
              flex: 1,
              minWidth: 0,
              px: '8px',
              textAlign: 'center',
              borderLeft: index === 0 ? 'none' : '1px solid #E3E9F3',
            }}
          >
            <Typography
              sx={{
                fontSize: 24,
                fontWeight: 800,
                lineHeight: 1.2,
                color: '#0B1B3F',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {cell.value}
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mt: '2px', lineHeight: 1.25 }}>{cell.label}</Typography>
          </Box>
        ))}
      </Stack>

      {/* Games and level */}
      <Typography sx={sectionTitleSx}>Igre i nivo</Typography>
      {gameSports.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {gameSports.map((sport) => {
            const level = levelFor(sport);
            return (
              <Box
                key={sport}
                sx={{
                  flex: '1 1 0',
                  minWidth: 100,
                  px: '8px',
                  py: '10px',
                  borderRadius: '14px',
                  bgcolor: '#EAF1FD',
                  border: '1px solid #DCE7FA',
                }}
              >
                <Stack direction="row" alignItems="center" spacing="5px">
                  <SportIcon sport={sport} size={18} />
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1B3F' }}>
                    {getGameTypeName(sport)}
                  </Typography>
                </Stack>
                {level && (
                  <Box
                    sx={{
                      mt: '6px',
                      display: 'inline-block',
                      px: '8px',
                      py: '1px',
                      borderRadius: '8px',
                      bgcolor: '#DCE9FF',
                      color: 'primary.main',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {level}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 14.5, color: '#6B7A99' }}>Igrač još nije izabrao omiljene sportove.</Typography>
      )}

      {/* About */}
      {user.bio && (
        <>
          <Typography sx={sectionTitleSx}>Kratko o meni</Typography>
          <Box sx={{ p: '14px 16px', bgcolor: '#EDF2FA', border: '1px solid #E3E9F3', borderRadius: '14px' }}>
            <Typography sx={{ fontSize: 15.5, lineHeight: 1.45, color: '#0B1B3F', whiteSpace: 'pre-line' }}>
              {user.bio}
            </Typography>
          </Box>
        </>
      )}

      {/* Actions */}
      {isSelf && (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => navigate('/profil')}
          sx={{
            mt: '22px',
            height: 52,
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            bgcolor: '#EEF5FF',
            borderColor: '#B9D4FB',
            '&:hover': { bgcolor: '#E2EEFF', borderColor: '#9CC4FA' },
          }}
        >
          Moj profil
        </Button>
      )}
      {canAct && (
        <>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            startIcon={<PersonAddIcon />}
            onClick={() => setSheet('invite')}
            disabled={isBlocked}
            sx={{ mt: '22px', height: 56, borderRadius: '12px', fontSize: 17, fontWeight: 700 }}
          >
            Pozovi na meč
          </Button>
          <Box sx={{ mt: '14px', bgcolor: '#FFFFFF', border: '1px solid #E3E9F3', borderRadius: '16px', overflow: 'hidden' }}>
            {commonCount !== undefined && (
              <MenuRow
                icon={CommonMatchesIcon}
                label="Zajednički mečevi"
                detail={String(commonCount)}
                onClick={() => setSheet('common')}
              />
            )}
            <MenuRow
              icon={BlockIcon}
              label={isBlocked ? 'Odblokiraj igrača' : 'Blokiraj igrača'}
              danger={!isBlocked}
              onClick={() => (isBlocked ? handleBlockToggle() : setSheet('block'))}
              last
            />
          </Box>
        </>
      )}

      {/* Invite to a match */}
      <InviteToMatchSheet
        open={sheet === 'invite'}
        onClose={() => setSheet(null)}
        playerId={user._id}
        playerName={user.name}
        onSent={() => setNotice({ severity: 'success', text: `Pozivnica je poslata igraču ${user.name}.` })}
      />

      {/* Block confirmation */}
      <BottomSheet open={sheet === 'block'} onClose={() => !blockLoading && setSheet(null)} title="Blokiraj igrača?">
        <Typography sx={{ fontSize: 15, color: '#0B1B3F', mb: '10px' }}>
          Da li ste sigurni da želite da blokirate igrača <strong>{user.name}</strong>? Blokirani igrač neće moći da:
        </Typography>
        <Box component="ul" sx={{ m: 0, mb: '18px', pl: '20px', color: '#6B7A99', fontSize: 14.5, lineHeight: 1.6 }}>
          <li>vidi vaše kreirane mečeve</li>
          <li>se prijavi na vaše mečeve</li>
        </Box>
        <Button
          fullWidth
          variant="destructive"
          onClick={handleBlockToggle}
          disabled={blockLoading}
          sx={{ height: 50, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          {blockLoading ? 'Blokiranje...' : 'Blokiraj'}
        </Button>
        <Button
          fullWidth
          variant="soft"
          onClick={() => setSheet(null)}
          disabled={blockLoading}
          sx={{ mt: '8px', height: 48, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          Odustani
        </Button>
      </BottomSheet>

      {/* Common matches */}
      <BottomSheet open={sheet === 'common'} onClose={() => setSheet(null)} title="Zajednički mečevi">
        {!commonMatches || commonMatches.length === 0 ? (
          <Typography sx={{ fontSize: 15, color: '#6B7A99', py: '8px' }}>
            Igrač se još nije prijavio ni na jedan tvoj meč.
          </Typography>
        ) : (
          <Stack spacing="8px" sx={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {commonMatches.map((m) => (
              <ButtonBase
                key={m._id}
                onClick={() => {
                  setSheet(null);
                  navigate(`/matches/${m._id}`);
                }}
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
                  border: '1px solid #E3E9F3',
                  bgcolor: '#FFFFFF',
                }}
              >
                <SportIcon sport={m.sport} size={32} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, color: '#0B1B3F' }}>
                    {getGameTypeName(m.sport)}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 13.5, color: '#6B7A99' }}>
                    {formatDateTime(m.dateTime)} · {m.fieldName}
                  </Typography>
                </Box>
                <ChevronRightIcon sx={{ color: '#9AA6BF' }} />
              </ButtonBase>
            ))}
          </Stack>
        )}
      </BottomSheet>

      {/* More details (everything the old profile page showed that is not on the main screen) */}
      <BottomSheet open={sheet === 'details'} onClose={() => setSheet(null)} title="Detalji igrača">
        {user.experience && detailRow('Iskustvo', experienceLabels[user.experience] || user.experience)}
        {user.skills && detailRow('Veštine', user.skills)}
        {user.phone &&
          detailRow(
            'Telefon',
            <Stack direction="row" alignItems="center" spacing="6px">
              <PhoneIcon sx={{ fontSize: 18, color: '#5B6B8C' }} />
              <span>{user.phone}</span>
            </Stack>
          )}
        {analytics ? (
          <>
            {detailRow('Kreirani mečevi', analytics.totalRegistered)}
            {detailRow('Prijavljeni mečevi', analytics.totalJoinMatch)}
            {detailRow('Odigrano', analytics.totalReserved)}
            {detailRow('Otkazano', analytics.totalCancelled, true)}
          </>
        ) : (
          <Typography sx={{ fontSize: 14.5, color: '#6B7A99', py: '8px' }}>Statistika nije dostupna.</Typography>
        )}
      </BottomSheet>
    </Box>
  );
}
