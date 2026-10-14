'use client';

import React, { useState, useEffect, useRef, type ElementType, type ReactNode } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ButtonBase,
  Stack,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Switch,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Dialog,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  NotificationsActive as NotificationsActiveIcon,
  PlaceOutlined as PlaceIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  Star as StarIcon,
  ChevronRight as ChevronRightIcon,
  PeopleOutline as PeopleIcon,
  EventAvailableOutlined as MyGamesIcon,
  NotificationsNone as NotificationsNoneIcon,
  PersonAddAltOutlined as InviteIcon,
  SettingsOutlined as SettingsIcon,
  MilitaryTechOutlined as BadgeIcon,
  InsightsOutlined as StatsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useNavigate, Link, useSearchParams } from '@/lib/router';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { User, PlayerAnalytics } from '../types';
import { getTrustBadge } from '../lib/reliability';
import PreferredGamesPicker from '../components/PreferredGamesPicker';
import BottomSheet from '../components/BottomSheet';
import { getGameTypeName } from '../constants/games';
import { BADGE_CATALOG, getXpProgress, getCreditsDisplay } from '../lib/gamification';

const TRUST_COLOR = { reliable: '#1B8A4B', caution: '#D9531E', risky: '#D92D20' } as const;

type SheetKey = 'invite' | 'level' | 'stats' | 'settings' | null;

function formatRating(value?: number): string {
  return Number(value || 0).toFixed(1).replace('.', ',');
}

function MenuRow({
  icon: Icon,
  label,
  detail,
  onClick,
  danger = false,
  last = false,
  ...rest
}: {
  icon: ElementType;
  label: string;
  detail?: string;
  onClick: () => void;
  danger?: boolean;
  last?: boolean;
  'data-tour'?: string;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      {...rest}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '14px',
        px: '16px',
        height: 56,
        textAlign: 'left',
        borderBottom: last ? 'none' : '1px solid #EEF2F8',
        color: danger ? '#D92D20' : '#0B1B3F',
      }}
    >
      <Icon sx={{ fontSize: 24, color: danger ? '#D92D20' : '#5B6B8C' }} />
      <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 500, color: 'inherit' }}>{label}</Typography>
      {detail && <Typography sx={{ fontSize: 14, color: '#6B7A99' }}>{detail}</Typography>}
      {!danger && <ChevronRightIcon sx={{ color: '#9AA6BF' }} />}
    </ButtonBase>
  );
}

export default function PlayerProfile() {
  const { user: currentUser, refreshUser, logout } = useAuth();
  const { mode, toggleColorMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const gamesSectionRef = useRef<HTMLDivElement>(null);
  const shouldOpenPreferredGames = useRef(
    searchParams.get('edit') === 'igre' ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === 'igre')
  );
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    skills: '',
    phone: '',
    location: '',
    preferredSports: [] as string[],
    experience: 'beginner' as 'beginner' | 'intermediate' | 'advanced' | 'professional',
    avatarUrl: '',
    notificationEnabled: true,
  });

  useEffect(() => {
    loadProfile();
    loadAnalytics();
    if (shouldOpenPreferredGames.current) {
      setEditing(true);
    }
    // "/profil?sheet=invite" (from the Moji igrači header) opens the invite-a-friend sheet
    if (
      searchParams.get('sheet') === 'invite' ||
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sheet') === 'invite')
    ) {
      setSheet('invite');
    }
  }, []);

  useEffect(() => {
    if (!shouldOpenPreferredGames.current || !editing || loading || !user) return;
    const timer = window.setTimeout(() => {
      gamesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      shouldOpenPreferredGames.current = false;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [editing, loading, user]);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await api.get('/api/players/profile');
      setUser(res.data);
      setFormData({
        name: res.data.name || '',
        bio: res.data.bio || '',
        skills: res.data.skills || '',
        phone: res.data.phone || '',
        location: res.data.location || '',
        preferredSports: res.data.preferredSports || [],
        experience: res.data.experience || 'beginner',
        avatarUrl: res.data.avatarUrl || '',
        notificationEnabled: res.data.notificationEnabled !== undefined ? res.data.notificationEnabled : true,
      });
      requestLocationAndSubscribe();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju profila');
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const res = await api.get('/api/players/analytics');
      setAnalytics(res.data);
    } catch (err: any) {
      console.error('Analytics error:', err);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await api.put('/api/players/profile', formData);
      setUser(res.data);
      setEditing(false);
      setSuccess('Profil je uspešno ažuriran!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri čuvanju profila');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Samo slike su dozvoljene (JPEG, PNG, GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Slika je prevelika. Maksimalna veličina je 5MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      setError(null);

      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/api/players/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update local user state
      setUser(prev => prev ? { ...prev, avatarUrl: res.data.avatarUrl } : null);
      // Also update the global auth context
      await refreshUser();

      setSuccess('Slika profila je uspešno ažurirana!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri otpremanju slike');
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleCancel() {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        skills: user.skills || '',
        phone: user.phone || '',
        location: user.location || '',
        preferredSports: user.preferredSports || [],
        experience: user.experience || 'beginner',
        avatarUrl: user.avatarUrl || '',
        notificationEnabled: user.notificationEnabled !== undefined ? user.notificationEnabled : true,
      });
    }
    setEditing(false);
    setError(null);
  }

  async function handleTestNotification() {
    // Check if user has push subscription first
    if (!user?.pushSubscription) {
      setSheet(null);
      setError(
        <span>
          Nema aktivne pretplate na push notifikacije.{' '}
          <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
            Otvori postavke obaveštenja
          </Link>{' '}
          da se pretplatiš.
        </span>
      );
      return;
    }

    try {
      setTestingNotification(true);
      setError(null);
      const res = await api.post('/api/players/test-push');
      setSuccess(res.data.message || 'Test notifikacija poslata! Proveri da li si je primio.');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Greška pri slanju test notifikacije';
      // If the error is about missing subscription, provide helpful link
      if (errorMessage.includes('Nema push subscription') || errorMessage.includes('pretplat')) {
        setError(
          <span>
            {errorMessage}.{' '}
            <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Klikni ovde da se pretplatiš
            </Link>
          </span>
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setTestingNotification(false);
    }
  }

  async function requestLocationAndSubscribe() {
    if (!currentUser || currentUser.role !== 'player') return;
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.post('/api/players/location', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            } catch (err) {
              console.log('Location update skipped:', err);
            }
          },
          (error) => {
            // Silently handle geolocation errors - not critical for app function
            if (error.code === error.TIMEOUT) {
              console.log('Location request timed out - using last known position if available');
            } else if (error.code === error.PERMISSION_DENIED) {
              console.log('Location permission denied by user');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              console.log('Location information unavailable');
            }
          },
          { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
        );
      }
    } catch (error) {
      console.log('Geolocation not supported or error:', error);
    }
  }

  function handlePreferredGamesChange(gameIds: string[]) {
    setFormData({
      ...formData,
      preferredSports: gameIds,
    });
  }

  async function handleCopyInviteLink() {
    if (!user) return;
    const link = `${window.location.origin}/register?ref=${user._id}`;
    try {
      await navigator.clipboard.writeText(link);
      setSuccess('Link za pozivnicu je kopiran!');
    } catch {
      setSuccess(link);
    }
    setSheet(null);
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Alert severity="error">Korisnik nije pronađen</Alert>;
  }

  const experienceLabels: Record<string, string> = {
    beginner: 'Početnik',
    intermediate: 'Srednji',
    advanced: 'Napredni',
    professional: 'Profesionalac'
  };

  const xpInfo = getXpProgress(user.xp || 0);
  const level = user.level || xpInfo.level;
  const credits = getCreditsDisplay(user.credits);
  const trust = analytics ? getTrustBadge(analytics.reliabilityScore) : null;
  const hasRatings = (user.ratingsCount ?? 0) > 0 || Number(user.ratingAvg || 0) > 0;

  const alerts = (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
    </>
  );

  const statBox = (value: ReactNode, label: string, color = '#0B1B3F') => (
    <Box sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, color, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mt: '2px' }}>{label}</Typography>
    </Box>
  );

  const infoPaperSx = { p: 2, borderRadius: '12px', bgcolor: '#F4F7FC', boxShadow: 'none' };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      {alerts}

      {/* Header: avatar, name, location, bio */}
      <Stack direction="row" spacing="16px" alignItems="center">
        <Avatar
          src={user.avatarUrl}
          alt={user.name}
          sx={{ width: 84, height: 84, bgcolor: 'primary.main', fontSize: 34, fontWeight: 700, flexShrink: 0 }}
        >
          {user.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F', lineHeight: 1.2 }}>
            {user.name}
          </Typography>
          {user.location && (
            <Stack direction="row" alignItems="center" spacing="4px" sx={{ mt: '4px', color: '#6B7A99' }}>
              <PlaceIcon sx={{ fontSize: 18 }} />
              <Typography noWrap sx={{ fontSize: 15 }}>{user.location}</Typography>
            </Stack>
          )}
          <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mt: user.location ? '2px' : '4px' }}>
            {experienceLabels[user.experience || 'beginner']}
          </Typography>
        </Box>
      </Stack>
      {user.bio && (
        <Typography sx={{ fontSize: 15.5, lineHeight: 1.45, color: '#0B1B3F', mt: '14px', whiteSpace: 'pre-line' }}>
          {user.bio}
        </Typography>
      )}

      {/* Stats */}
      <Stack direction="row" sx={{ mt: '20px' }}>
        {statBox(
          analytics ? `${analytics.reliabilityScore}/100` : '–',
          'Pouzdanost',
          trust ? TRUST_COLOR[trust.level] : '#0B1B3F'
        )}
        {statBox(analytics ? analytics.totalReserved : '–', 'meča')}
        {statBox(
          hasRatings ? (
            <>
              <StarIcon sx={{ fontSize: 22, color: '#F5B301' }} />
              {formatRating(user.ratingAvg)}
            </>
          ) : (
            '–'
          ),
          'ocena'
        )}
      </Stack>

      {/* Sports */}
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0B1B3F', mt: '24px', mb: '10px' }}>
        Moji sportovi
      </Typography>
      {user.preferredSports && user.preferredSports.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {user.preferredSports.map((sport) => (
            <Box
              key={sport}
              sx={{
                px: '16px',
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '17px',
                bgcolor: '#E8F1FF',
                border: '1px solid #CFE1FB',
                color: 'primary.main',
                fontSize: 14.5,
                fontWeight: 600,
              }}
            >
              {getGameTypeName(sport)}
            </Box>
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 14.5, color: '#6B7A99' }}>Još nisi izabrao omiljene sportove.</Typography>
      )}

      <Button
        fullWidth
        variant="outlined"
        onClick={() => setEditing(true)}
        sx={{
          mt: '18px',
          height: 50,
          borderRadius: '12px',
          fontSize: 16,
          fontWeight: 700,
          color: 'primary.main',
          bgcolor: '#EEF5FF',
          borderColor: '#B9D4FB',
          '&:hover': { bgcolor: '#E2EEFF', borderColor: '#9CC4FA' },
        }}
      >
        Izmeni profil
      </Button>

      {/* Menu */}
      <Box sx={{ mt: '18px', bgcolor: '#FFFFFF', border: '1px solid #E3E9F3', borderRadius: '16px', overflow: 'hidden' }}>
        <MenuRow icon={PeopleIcon} label="Moji igrači" onClick={() => navigate('/moji-igraci')} />
        <MenuRow icon={MyGamesIcon} label="Moje igre" onClick={() => navigate('/moji-mecevi')} />
        <MenuRow icon={NotificationsNoneIcon} label="Obaveštenja" onClick={() => navigate('/notification-settings')} />
        <MenuRow icon={InviteIcon} label="Pozovi drugara" onClick={() => setSheet('invite')} />
        <MenuRow icon={BadgeIcon} label="Nivo i bedževi" detail={`Nivo ${level}`} onClick={() => setSheet('level')} />
        <MenuRow icon={StatsIcon} label="Statistika" onClick={() => setSheet('stats')} />
        <MenuRow icon={SettingsIcon} label="Podešavanja" onClick={() => setSheet('settings')} />
        <MenuRow icon={LogoutIcon} label="Odjavi se" onClick={handleLogout} danger last />
      </Box>

      {/* Invite a friend */}
      <BottomSheet open={sheet === 'invite'} onClose={() => setSheet(null)} title="Pozovi drugara">
        <Typography sx={{ fontSize: 14.5, color: '#6B7A99', mb: '14px' }}>
          Pošalji link prijatelju. Krediti služe za hitan signal ili pozivnice igračima.
        </Typography>
        <Stack spacing="8px" sx={{ mb: '16px' }}>
          {[
            { title: 'Odigraj meč', detail: '+50 XP po odigranom meču' },
            { title: 'Organizuj meč', detail: '+80 XP i +1 kredit organizatoru' },
            { title: 'Dovedi prijatelja', detail: '+2 kredita tebi i njemu posle prvog meča' },
          ].map((tip) => (
            <Paper key={tip.title} elevation={0} sx={{ ...infoPaperSx, py: 1.25 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{tip.title}</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#6B7A99' }}>{tip.detail}</Typography>
            </Paper>
          ))}
        </Stack>
        <Button
          fullWidth
          variant="contained"
          onClick={handleCopyInviteLink}
          sx={{ height: 50, borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          Kopiraj link za prijatelja
        </Button>
      </BottomSheet>

      {/* Level, credits, badges */}
      <BottomSheet open={sheet === 'level'} onClose={() => setSheet(null)} title="Nivo i bedževi">
        <Paper elevation={0} sx={{ ...infoPaperSx, mb: '14px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 800 }}>Nivo {level}</Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>
              {xpInfo.currentLevelXp} / {xpInfo.nextLevelXp} XP
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={xpInfo.progressPct}
            sx={{ height: 8, borderRadius: 4, bgcolor: '#DCE5F2', '& .MuiLinearProgress-bar': { borderRadius: 4 } }}
          />
          <Typography sx={{ fontSize: 13, color: '#6B7A99', mt: 0.75 }}>Ukupno {xpInfo.totalXp} XP</Typography>
        </Paper>
        <Paper elevation={0} sx={{ ...infoPaperSx, mb: '16px' }}>
          <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>Trenutni krediti</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{credits}</Typography>
          <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>Koristi za hitan signal ili pozivnice igračima</Typography>
        </Paper>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: '8px' }}>Bedževi</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {Object.values(BADGE_CATALOG).map((badge) => {
            const unlocked = (user.badges || []).some((b) => b.id === badge.id);
            return (
              <Chip
                key={badge.id}
                label={`${badge.emoji} ${badge.name}`}
                size="small"
                variant={unlocked ? 'filled' : 'outlined'}
                color={unlocked ? 'primary' : 'default'}
                title={badge.description}
                sx={{ opacity: unlocked ? 1 : 0.45, fontWeight: unlocked ? 600 : 400 }}
              />
            );
          })}
        </Box>
        {(user.badges || []).length === 0 && (
          <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mt: 1 }}>Igraj mečeve da otključaš bedževe</Typography>
        )}
      </BottomSheet>

      {/* Statistics */}
      <BottomSheet open={sheet === 'stats'} onClose={() => setSheet(null)} title="Statistika">
        {analytics ? (
          <Stack spacing="12px">
            {trust && (
              <Paper
                elevation={0}
                sx={{ p: 2, borderRadius: '14px', bgcolor: trust.bgColor, color: 'white', boxShadow: 'none' }}
              >
                <Typography sx={{ fontSize: 13, opacity: 0.9 }}>Pouzdanost igrača</Typography>
                <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>{analytics.reliabilityScore}%</Typography>
                <Typography sx={{ fontSize: 14, opacity: 0.95 }}>
                  {trust.emoji} {trust.label}
                </Typography>
              </Paper>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {[
                { label: 'Kreirani mečevi', value: analytics.totalRegistered, color: 'primary.main' },
                { label: 'Prijavljeni mečevi', value: analytics.totalJoinMatch, color: 'info.main' },
                { label: 'Odigrano', value: analytics.totalReserved, color: 'success.main' },
                { label: 'Otkazano', value: analytics.totalCancelled, color: 'error.main' },
              ].map((s) => (
                <Paper key={s.label} elevation={0} sx={infoPaperSx}>
                  <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</Typography>
                </Paper>
              ))}
            </Box>
            <Paper elevation={0} sx={infoPaperSx}>
              <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>Prosečna ocena igrača</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: 'warning.main' }}>
                {Number(user.ratingAvg || 0).toFixed(1)} / 5
              </Typography>
            </Paper>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 800, mb: '8px' }}>Nivo veštine po sportu</Typography>
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
                {(user.sportSkillLevels || []).length > 0 ? (
                  user.sportSkillLevels?.map((entry) => (
                    <Chip
                      key={`${entry.sport}-${entry.skillLevel}`}
                      label={`${getGameTypeName(entry.sport)}: ${entry.skillLevel}/5`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))
                ) : (
                  <Typography sx={{ fontSize: 14, color: '#6B7A99' }}>Još nema skill ocena</Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        ) : (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        )}
      </BottomSheet>

      {/* Settings */}
      <BottomSheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Podešavanja">
        <Stack spacing="4px">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 52 }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 600 }}>Tamna tema</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#6B7A99' }}>Izgled aplikacije</Typography>
            </Box>
            <Switch checked={mode === 'dark'} onChange={toggleColorMode} inputProps={{ 'aria-label': 'Tamna tema' }} />
          </Stack>
          <Divider />
          <Box sx={{ py: '10px' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600 }}>Obaveštenja</Typography>
            <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mb: '10px' }}>
              {user.notificationEnabled ? `Omogućena (${user.notificationRadius || 10} km radijus)` : 'Onemogućena'}
            </Typography>
            <Stack direction="row" spacing="8px">
              <Button
                variant="outlined"
                onClick={() => navigate('/notification-settings/postavke')}
                sx={{ flex: 1, height: 44, borderRadius: '12px', fontWeight: 600 }}
              >
                Postavke
              </Button>
              <Button
                variant="outlined"
                startIcon={<NotificationsActiveIcon />}
                onClick={handleTestNotification}
                disabled={testingNotification}
                sx={{ flex: 1, height: 44, borderRadius: '12px', fontWeight: 600 }}
              >
                {testingNotification ? 'Slanje...' : 'Test'}
              </Button>
            </Stack>
            {!user.pushSubscription && (
              <Typography sx={{ fontSize: 12.5, color: '#6B7A99', mt: '8px' }}>
                Za test morate biti pretplaćeni na notifikacije.
              </Typography>
            )}
          </Box>
          <Divider />
          <Box sx={{ pt: '10px' }}>
            <Typography sx={{ fontSize: 13, color: '#6B7A99' }}>Prijavljen kao</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{user.email}</Typography>
            {user.phone && <Typography sx={{ fontSize: 14, color: '#6B7A99' }}>{user.phone}</Typography>}
          </Box>
        </Stack>
      </BottomSheet>

      {/* Edit profile */}
      <Dialog
        open={editing}
        onClose={saving ? undefined : handleCancel}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            // "&&" beats the global MuiDialog paper overrides (margin / radius / width) from the theme
            sx: {
              '&&': {
                margin: fullScreen ? 0 : '16px',
                width: fullScreen ? '100%' : 'calc(100% - 32px)',
                maxHeight: fullScreen ? '100dvh' : 'calc(100% - 32px)',
                height: fullScreen ? '100dvh' : 'auto',
                borderRadius: fullScreen ? 0 : '20px',
                bgcolor: '#FFFFFF',
              },
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 1, py: 1, borderBottom: '1px solid #E3E9F3', flexShrink: 0 }}
        >
          <IconButton aria-label="Zatvori" onClick={handleCancel} disabled={saving}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{ flex: 1, fontSize: 18, fontWeight: 800 }}>Izmeni profil</Typography>
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={formData.avatarUrl}
                  sx={{ width: 96, height: 96, bgcolor: 'primary.main', fontSize: 38, fontWeight: 700 }}
                >
                  {user.name?.charAt(0).toUpperCase()}
                </Avatar>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
                <IconButton
                  aria-label="Promeni sliku"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -8,
                    bgcolor: '#FFFFFF',
                    boxShadow: '0 2px 8px rgba(11,27,63,0.2)',
                    '&:hover': { bgcolor: '#F4F7FC' },
                    width: 38,
                    height: 38,
                  }}
                >
                  {uploadingAvatar ? <CircularProgress size={20} /> : <PhotoCameraIcon sx={{ fontSize: 20 }} />}
                </IconButton>
              </Box>
            </Box>

            <TextField
              fullWidth
              label="URL avatara"
              value={formData.avatarUrl}
              onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
            />
            <TextField
              fullWidth
              label="Ime"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Biografija"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              multiline
              rows={4}
              placeholder="Napišite nešto o sebi..."
            />
            <TextField
              fullWidth
              label="Veštine"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              multiline
              rows={2}
              placeholder="Opišite svoje veštine..."
            />
            <TextField
              fullWidth
              label="Telefon"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <TextField
              fullWidth
              label="Lokacija"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
            <TextField
              fullWidth
              select
              label="Nivo iskustva"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value as any })}
              SelectProps={{ native: true }}
            >
              <option value="beginner">Početnik</option>
              <option value="intermediate">Srednji</option>
              <option value="advanced">Napredni</option>
              <option value="professional">Profesionalac</option>
            </TextField>

            {/* Preferred games: category → game type */}
            <Box ref={gamesSectionRef} sx={{ scrollMarginTop: 16 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1.5 }}>Omiljene igre</Typography>
              <PreferredGamesPicker
                key={`preferred-games-${user._id}-${editing}`}
                value={formData.preferredSports}
                onChange={handlePreferredGamesChange}
                disabled={saving}
              />
            </Box>

            <Divider />
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notificationEnabled}
                    onChange={(e) => setFormData({ ...formData, notificationEnabled: e.target.checked })}
                  />
                }
                label="Omogući obaveštenja o mečevima u blizini"
              />
              <Typography sx={{ fontSize: 13.5, color: '#6B7A99' }}>
                Radijus obaveštenja se podešava na{' '}
                <Link to="/notification-settings" style={{ fontWeight: 600 }}>
                  stranici obaveštenja
                </Link>
                .
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ p: 2, borderTop: '1px solid #E3E9F3', flexShrink: 0 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleCancel}
            disabled={saving}
            sx={{ height: 48, borderRadius: '12px', fontWeight: 700 }}
          >
            Otkaži
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ height: 48, borderRadius: '12px', fontWeight: 700 }}
          >
            {saving ? 'Čuvanje...' : 'Sačuvaj'}
          </Button>
        </Stack>
      </Dialog>
    </Box>
  );
}
