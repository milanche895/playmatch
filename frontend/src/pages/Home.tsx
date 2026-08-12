import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Box,
  Divider,
  Card,
  CardContent,
  Fab,
  RadioGroup,
  FormControlLabel,
  Radio,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match, Field } from '../types';
import { useAuth } from '../context/AuthContext';
import { persistPlayerLocation } from '../lib/location';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../lib/notifications';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MapIcon from '@mui/icons-material/Map';
import ViewListIcon from '@mui/icons-material/ViewList';
import BrandHero from '../components/BrandHero';
import { brand } from '../theme';
import {
  getGameTypeName,
  matchBelongsToPreferredGames,
} from '../constants/games';

// Custom icons using HTML div icons for better customization
function createCustomIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

const matchIcon = createCustomIcon(brand.cyan);
const fieldIcon = createCustomIcon(brand.blue);
const informalMatchIcon = createCustomIcon(brand.orange);

// Function to calculate distance between two coordinates (in km)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Component to center map on user location
function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 13);
  }, [map, position]);
  return null;
}

// Fix default Leaflet icon URLs for Vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Helper function to format players count display
function formatPlayersCount(match: Match): string {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded;
  const max = match.maxPlayers;

  if (max) {
    return `${current}/${min}-${max}`;
  }
  return `${current}/${min}`;
}

function formatRelativeMatchTime(dateTimeString: string): string {
  const matchDate = new Date(dateTimeString);
  const now = new Date();
  const timeStr = matchDate.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
  const dayDiff = Math.round((startOfMatchDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return `Danas u ${timeStr}`;
  if (dayDiff === 1) return `Sutra u ${timeStr}`;
  if (dayDiff === -1) return `Juče u ${timeStr}`;

  const dateStr = matchDate.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
  return `${dateStr} u ${timeStr}`;
}

function getMatchLocationName(match: Match): string {
  if (match.isInformal) return match.informalLocation?.name || 'Privatni teren';
  return typeof match.fieldId === 'object' && match.fieldId?.name ? match.fieldId.name : 'Nepoznat teren';
}

function getMatchCoords(match: Match): { lat: number; lng: number } | null {
  if (match.isInformal) {
    if (match.informalLocation?.lat == null || match.informalLocation?.lng == null) return null;
    return { lat: match.informalLocation.lat, lng: match.informalLocation.lng };
  }
  if (typeof match.fieldId === 'object' && match.fieldId?.lat != null && match.fieldId?.lng != null) {
    return { lat: match.fieldId.lat, lng: match.fieldId.lng };
  }
  return null;
}

function getSpotsNeededLabel(match: Match): string {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded ?? 0;
  const max = match.maxPlayers;
  const target = max || min;
  const remaining = Math.max(0, target - current);

  if (remaining === 0) return 'Meč je popunjen';
  if (remaining === 1) return 'Fali još 1 igrač!';
  return `Fali još ${remaining} igrača!`;
}

function translateMatchStatus(status: string, courtApproval?: string): string {
  if (courtApproval === 'pending') return 'Na čekanju';
  switch (status) {
    case 'open': return 'Otvoren';
    case 'full': return 'Pun';
    case 'completed': return 'Završen';
    case 'failed': return 'Neuspešan';
    case 'otkazano': return 'Otkazan';
    default: return status;
  }
}

const VIEW_MODE_KEY = 'playmatch_home_view';
const SPORT_FILTER_KEY = 'playmatch_home_sport_filter';

// Match Card Component — optimized for list "first screen action"
function MatchCard({
  match,
  user,
  isUserInMatch,
  isOnWaitlist,
  onJoin,
  onJoinWaitlist,
  userLocation,
  joiningId,
}: {
  match: Match;
  user: any;
  isUserInMatch: boolean;
  isOnWaitlist: boolean;
  onJoin: (id: string) => void;
  onJoinWaitlist: (id: string) => void;
  userLocation: [number, number] | null;
  joiningId?: string | null;
}) {
  const navigate = useNavigate();
  const isFull = match.players.length >= (match.maxPlayers || 100);
  const isJoining = joiningId === match._id;

  const getStatusColor = () => {
    if (match.status === 'full') return 'warning';
    if (match.courtApproval === 'pending') return 'default';
    return 'success';
  };

  const coords = getMatchCoords(match);
  const locationName = getMatchLocationName(match);
  const distanceKm =
    userLocation && coords
      ? getDistance(userLocation[0], userLocation[1], coords.lat, coords.lng)
      : null;
  const locationLine =
    distanceKm != null
      ? `${locationName} · ${distanceKm.toFixed(1)} km`
      : locationName;

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={1.75}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                <SportsSoccerIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {getGameTypeName(match.sport)}
                </Typography>
                <Typography variant="body2" color="text.secondary">·</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatRelativeMatchTime(match.dateTime)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />
                <Typography variant="subtitle1" fontWeight={700} noWrap>
                  {locationLine}
                </Typography>
              </Stack>
            </Box>
            <Chip
              label={translateMatchStatus(match.status, match.courtApproval)}
              size="small"
              color={getStatusColor() as any}
              sx={{ fontWeight: 600, flexShrink: 0 }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 16 }} />}
              label={getSpotsNeededLabel(match)}
              size="small"
              color={isFull ? 'default' : 'warning'}
              sx={{ fontWeight: 700 }}
            />
            <Typography variant="caption" color="text.secondary">
              {formatPlayersCount(match)}
            </Typography>
            {isUserInMatch && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label="Pridružen"
                size="small"
                color="success"
                sx={{ fontWeight: 600 }}
              />
            )}
            {isOnWaitlist && (
              <Chip label="Na listi čekanja" size="small" color="warning" sx={{ fontWeight: 600 }} />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            {!isUserInMatch && user?.role !== 'court' && (
              isOnWaitlist ? (
                <Button
                  variant="outlined"
                  color="warning"
                  fullWidth
                  onClick={() => navigate(`/matches/${match._id}`)}
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  Na listi čekanja
                </Button>
              ) : isFull ? (
                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  disabled={isJoining}
                  onClick={() => onJoinWaitlist(match._id)}
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  {isJoining ? 'Prijavljivanje...' : 'Stani u red'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  disabled={isJoining}
                  onClick={() => onJoin(match._id)}
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  {isJoining ? 'Prijavljivanje...' : 'Prijavi se'}
                </Button>
              )
            )}
            <Button
              variant="outlined"
              size="medium"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/matches/${match._id}`)}
              sx={{ borderRadius: 2, fontWeight: 600, flexShrink: 0, minWidth: isUserInMatch || user?.role === 'court' ? '100%' : undefined }}
              fullWidth={isUserInMatch || user?.role === 'court'}
            >
              Detalji
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allFieldMatches, setAllFieldMatches] = useState<Record<string, Match[]>>({});
  const [fields, setFields] = useState<Field[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notificationChoice, setNotificationChoice] = useState<'enabled' | 'disabled'>('disabled');
  const [savingNotificationPreference, setSavingNotificationPreference] = useState(false);
  const [notificationPreferenceError, setNotificationPreferenceError] = useState<string | null>(null);
  const [notificationPreferenceSuccess, setNotificationPreferenceSuccess] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'map' || saved === 'list') return saved;
    return 'list';
  });
  const [sportFilter, setSportFilter] = useState<'preferred' | 'all'>(() => {
    const saved = localStorage.getItem(SPORT_FILTER_KEY);
    if (saved === 'preferred' || saved === 'all') return saved;
    return 'preferred';
  });

  const preferredSports = user?.preferredSports || [];
  const hasPreferences = preferredSports.length > 0;

  // Use user's notification radius if available (convert km to meters for map), default 10km
  const effectiveRadius = user?.notificationRadius || 10;

  const defaultCenter: [number, number] = [44.7866, 20.4489]; // Belgrade as default
  const mapCenter = userLocation || defaultCenter;

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  };

  useEffect(() => {
    if (user?.notificationEnabled === false) {
      setNotificationChoice('disabled');
    }
  }, [user?.notificationEnabled]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.latitude && position.coords.longitude) {
            const location: [number, number] = [
              position.coords.latitude,
              position.coords.longitude,
            ];
            setUserLocation(location);
            if (user?.role === 'player') {
              persistPlayerLocation(location[0], location[1]);
            }
          } else {
            console.warn('Geolocation returned null coordinates');
            setLocationError('Nije moguće dobiti vašu lokaciju. Prikazuju se svi mečevi.');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Nije moguće dobiti vašu lokaciju. Prikazuju se svi mečevi.';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Dozvola za lokaciju je odbijena. Molimo omogućite pristup lokaciji u postavkama vašeg pretraživača.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Informacije o lokaciji nisu dostupne.';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'Zahtev za lokaciju je istekao.';
          }
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 300000, // Accept positions up to 5 minutes old
        }
      );
    } else {
      setLocationError('Geolokacija nije podržana u vašem pretraživaču.');
    }

    api.get('/api/fields').then((fieldsRes) => {
      const validFields = fieldsRes.data.filter((f: Field) => f.lat && f.lng);
      setFields(validFields);
    }).catch(() => {
      console.error('Failed to load fields');
    });

    api.get('/api/matches').then((matchesRes) => {
      const activeMatches = matchesRes.data.filter((m: Match) =>
        (m.status === 'open' || m.status === 'full') &&
        m.courtApproval !== 'rejected'
      );
      setAllMatches(activeMatches);
      setMatches(activeMatches);

      const matchesByField: Record<string, Match[]> = {};
      matchesRes.data.forEach((match: Match) => {
        if (!match.fieldId) return;
        const fieldId = typeof match.fieldId === 'object' ? match.fieldId._id : match.fieldId;
        if (!matchesByField[fieldId]) {
          matchesByField[fieldId] = [];
        }
        if (match.status !== 'otkazano' && match.courtApproval !== 'rejected') {
          matchesByField[fieldId].push(match);
        }
      });
      setAllFieldMatches(matchesByField);

      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (userLocation && allMatches.length > 0) {
      const nearbyMatches = allMatches.filter((match) => {
        const lat = match.isInformal ? match.informalLocation?.lat : match.fieldId?.lat;
        const lng = match.isInformal ? match.informalLocation?.lng : match.fieldId?.lng;
        if (!lat || !lng) return false;
        const distance = getDistance(userLocation[0], userLocation[1], lat, lng);
        return distance <= effectiveRadius;
      });
      setMatches(nearbyMatches);
    } else if (allMatches.length > 0 && !userLocation) {
      const validMatches = allMatches.filter((match) =>
        (match.isInformal && match.informalLocation?.lat && match.informalLocation?.lng) ||
        (match.fieldId && match.fieldId.lat && match.fieldId.lng)
      );
      setMatches(validMatches);
    }
  }, [userLocation, allMatches]);

  async function handleJoinMatch(matchId: string) {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      setJoiningId(matchId);
      const res = await api.post(`/api/matches/${matchId}/join`);
      applyUpdatedMatch(res.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Neuspešno pridruživanje meču';
      alert(errorMsg);
    } finally {
      setJoiningId(null);
    }
  }

  async function handleJoinWaitlist(matchId: string) {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      setJoiningId(matchId);
      const res = await api.post(`/api/matches/${matchId}/waitlist`);
      applyUpdatedMatch(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno stajanje u red');
    } finally {
      setJoiningId(null);
    }
  }

  function applyUpdatedMatch(updatedMatch: Match) {
    const matchId = updatedMatch._id;
    const updatedAllMatches = allMatches.map((m) => (m._id === matchId ? updatedMatch : m));
    setAllMatches(updatedAllMatches);

    if (updatedMatch.fieldId) {
      const fieldId = typeof updatedMatch.fieldId === 'object' ? updatedMatch.fieldId._id : updatedMatch.fieldId;
      setAllFieldMatches((prev) => {
        const updated = { ...prev };
        if (!updated[fieldId]) {
          updated[fieldId] = [];
        }
        const fieldMatches = updated[fieldId];
        const matchIndex = fieldMatches.findIndex((m) => m._id === matchId);
        if (matchIndex >= 0) {
          fieldMatches[matchIndex] = updatedMatch;
        } else if (updatedMatch.status !== 'otkazano' && updatedMatch.courtApproval !== 'rejected') {
          fieldMatches.push(updatedMatch);
        }
        return updated;
      });
    }

    const filteredMatches = updatedAllMatches.filter((m: Match) => {
      if ((m.status !== 'open' && m.status !== 'full') || m.courtApproval === 'rejected') return false;
      const lat = m.isInformal ? m.informalLocation?.lat : m.fieldId?.lat;
      const lng = m.isInformal ? m.informalLocation?.lng : m.fieldId?.lng;
      if (!lat || !lng) return false;
      if (userLocation) {
        const distance = getDistance(userLocation[0], userLocation[1], lat, lng);
        return distance <= effectiveRadius;
      }
      return true;
    });
    setMatches(filteredMatches);
  }

  async function handleSaveNotificationPreference() {
    if (!user || user.role !== 'player') return;

    setSavingNotificationPreference(true);
    setNotificationPreferenceError(null);
    setNotificationPreferenceSuccess(null);

    try {
      if (notificationChoice === 'enabled') {
        await withTimeout(
          api.put('/api/players/profile', { notificationEnabled: true }),
          12000,
          'Čuvanje podešavanja traje predugo. Pokušajte ponovo.'
        );
        try {
          await subscribeToPushNotifications();
          setNotificationPreferenceSuccess(
            'Obaveštenja su omogućena. Dobijaćete push obaveštenja o novim mečevima u blizini.'
          );
        } catch (pushErr: any) {
          setNotificationPreferenceSuccess(
            'Preferenca je sačuvana. Za push obaveštenja u pozadini, omogućite dozvolu u pretraživaču ili na stranici postavki obaveštenja.'
          );
          if (pushErr?.message && !pushErr.message.includes('odbijena')) {
            setNotificationPreferenceError(pushErr.message);
          }
        }
        await withTimeout(
          refreshUser(),
          12000,
          'Osvežavanje profila traje predugo. Pokušajte ponovo.'
        );
      } else {
        await withTimeout(
          api.put('/api/players/profile', { notificationEnabled: false }),
          12000,
          'Čuvanje podešavanja traje predugo. Pokušajte ponovo.'
        );
        try {
          await unsubscribeFromPushNotifications();
        } catch {
          // Nema aktivne pretplate — ignoriši
        }
        await withTimeout(
          refreshUser(),
          12000,
          'Osvežavanje profila traje predugo. Pokušajte ponovo.'
        );
        setNotificationPreferenceSuccess('Obaveštenja su isključena.');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message;
      setNotificationPreferenceError(
        message ||
        'Greška pri čuvanju podešavanja obaveštenja.'
      );
    } finally {
      setSavingNotificationPreference(false);
    }
  }

  function isUserInMatch(match: Match): boolean {
    if (!user) return false;
    return match.players.some(p => p._id === user._id);
  }

  function isUserOnWaitlist(match: Match): boolean {
    if (!user) return false;
    return (match.waitlist || []).some((p) => p._id === user._id);
  }

  function isToday(dateTimeString: string): boolean {
    const matchDate = new Date(dateTimeString);
    const today = new Date();
    return (
      matchDate.getDate() === today.getDate() &&
      matchDate.getMonth() === today.getMonth() &&
      matchDate.getFullYear() === today.getFullYear()
    );
  }

  const displayedMatches = useMemo(() => {
    if (!hasPreferences || sportFilter === 'all' || !user || user.role !== 'player') {
      return matches;
    }
    return matches.filter((m) => matchBelongsToPreferredGames(m.sport, preferredSports));
  }, [matches, hasPreferences, sportFilter, preferredSports, user]);

  const todaysMatches = displayedMatches.filter(m => isToday(m.dateTime));
  const upcomingMatches = [...displayedMatches]
    .filter((m) => new Date(m.dateTime).getTime() > Date.now() - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const handleViewModeChange = (_: MouseEvent<HTMLElement>, next: 'list' | 'map' | null) => {
    if (!next) return;
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleSportFilterChange = (_: MouseEvent<HTMLElement>, next: 'preferred' | 'all' | null) => {
    if (!next) return;
    setSportFilter(next);
    localStorage.setItem(SPORT_FILTER_KEY, next);
  };

  return (
    <Box sx={{ position: 'relative', pb: user?.role === 'player' ? { xs: 10, sm: 8 } : 0 }}>
      <BrandHero />

      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
              Mečevi u blizini
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user
                ? `Pronađite mečeve u vašoj blizini${userLocation ? ` (unutar ${effectiveRadius} km)` : ''}`
                : 'Pregledajte dostupne mečeve i terene. Prijavite se da biste se pridružili meču.'}
            </Typography>
            {user?.role === 'player' && hasPreferences && sportFilter === 'preferred' && (
              <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.75, fontWeight: 600 }}>
                Prikaz: {preferredSports.map(getGameTypeName).join(' · ')}
              </Typography>
            )}
          </Box>
          <Stack spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
            {user?.role === 'player' && hasPreferences && (
              <ToggleButtonGroup
                value={sportFilter}
                exclusive
                onChange={handleSportFilterChange}
                size="small"
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    border: 0,
                    borderRadius: 2,
                  },
                }}
              >
                <ToggleButton value="preferred" aria-label="Moje igre">
                  Moje igre
                </ToggleButton>
                <ToggleButton value="all" aria-label="Svi mečevi">
                  Svi mečevi
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
              sx={{
                alignSelf: { xs: 'stretch', sm: 'flex-end' },
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  border: 0,
                  borderRadius: 2,
                },
              }}
            >
              <ToggleButton value="list" aria-label="Prikaz liste">
                <ViewListIcon sx={{ mr: 1, fontSize: 20 }} />
                Lista
              </ToggleButton>
              <ToggleButton value="map" aria-label="Prikaz mape">
                <MapIcon sx={{ mr: 1, fontSize: 20 }} />
                Mapa
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Box>

      {/* Alerts */}
      {locationError && user && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
          {locationError}
        </Alert>
      )}

      {user && user.role === 'player' && user.notificationEnabled === false && (
        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <NotificationsActiveIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Uključi obaveštenja o mečevima u blizini
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Da biste dobijali obaveštenja kada se kreira novi meč blizu vas, omogućite primanje obaveštenja.
              </Typography>

              <RadioGroup
                row
                value={notificationChoice}
                onChange={(event) => setNotificationChoice(event.target.value as 'enabled' | 'disabled')}
              >
                <FormControlLabel value="enabled" control={<Radio />} label="Da, omogući" />
                <FormControlLabel value="disabled" control={<Radio />} label="Ne za sada" />
              </RadioGroup>

              {notificationPreferenceError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {notificationPreferenceError}
                </Alert>
              )}

              {notificationPreferenceSuccess && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  {notificationPreferenceSuccess}
                </Alert>
              )}

              <Box>
                <Button
                  variant="contained"
                  onClick={handleSaveNotificationPreference}
                  disabled={savingNotificationPreference}
                >
                  {savingNotificationPreference ? 'Čuvanje...' : 'Sačuvaj izbor'}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* No matches alert */}
      {!loading && displayedMatches.length === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 3 }}>
          {user && userLocation
            ? sportFilter === 'preferred' && hasPreferences
              ? `Nema mečeva za ${preferredSports.map(getGameTypeName).join(', ')} u blizini. Prebaci se na „Svi mečevi“ ili kreiraj novi.`
              : `Nema aktivnih mečeva unutar ${effectiveRadius} km. Proširite pretragu ili kreirajte novi meč!`
            : sportFilter === 'preferred' && hasPreferences
              ? `Nema mečeva za ${preferredSports.map(getGameTypeName).join(', ')}. Prebaci se na „Svi mečevi“ ili kreiraj novi.`
              : 'Nema aktivnih mečeva u ovom trenutku.'}
        </Alert>
      )}

      {/* List View — first-screen action */}
      {!loading && viewMode === 'list' && upcomingMatches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            {todaysMatches.length > 0
              ? `Danas (${todaysMatches.length}) · ukupno ${upcomingMatches.length}`
              : `Predstojeći mečevi (${upcomingMatches.length})`}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {upcomingMatches.map((match) => (
              <MatchCard
                key={match._id}
                match={match}
                user={user}
                isUserInMatch={isUserInMatch(match)}
                isOnWaitlist={isUserOnWaitlist(match)}
                onJoin={handleJoinMatch}
                onJoinWaitlist={handleJoinWaitlist}
                userLocation={userLocation}
                joiningId={joiningId}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Map Section */}
      {!loading && viewMode === 'map' && (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MyLocationIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Mapa terena
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ height: { xs: isMobile ? '55vh' : '50vh', md: '60vh' } }}>
          <MapContainer
            center={mapCenter}
            zoom={userLocation ? 13 : 12}
            style={{ height: '100%', width: '100%' }}
          >
            {userLocation && <MapCenter position={mapCenter} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* User location radius circle - only show when user is logged in and has location */}
            {user && userLocation && (
              <Circle
                center={userLocation}
                radius={effectiveRadius * 1000} // Convert km to meters
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '5, 10',
                }}
              />
            )}

            {/* Field markers - filter by radius when user is logged in and has location */}
            {fields
              .filter((field) => {
                if (!field.lat || !field.lng) return false;
                // If user is logged in and has location, filter by radius
                if (user && userLocation) {
                  const distance = getDistance(
                    userLocation[0],
                    userLocation[1],
                    field.lat,
                    field.lng
                  );
                  return distance <= effectiveRadius;
                }
                return true; // Show all fields when not logged in or no location
              })
              .map((field) => {
                const allMatchesForField = allFieldMatches[field._id] || [];
                const todayMatches = allMatchesForField.filter(m => isToday(m.dateTime));
                const sortedMatches = [...todayMatches].sort((a, b) =>
                  new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
                );
                const reservedMatches = sortedMatches.filter(m =>
                  m.courtApproval === 'approved' &&
                  (m.status === 'open' || m.status === 'full' || m.status === 'completed')
                );
                const reservedMatchIds = new Set(reservedMatches.map(m => m._id));
                const activeMatches = sortedMatches.filter(m =>
                  !reservedMatchIds.has(m._id) &&
                  (m.status === 'open' || m.status === 'full') &&
                  m.courtApproval !== 'rejected'
                );

                return (
                  <Marker
                    key={`field-${field._id}`}
                    position={[field.lat, field.lng]}
                    icon={fieldIcon}
                  >
                    <Popup>
                      <Stack spacing={1.5} sx={{ minWidth: 0, width: '100%', maxWidth: 'min(360px, 78vw)' }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {field.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                          {(field.sports || [field.sport]).filter(Boolean).map((s) => (
                            <Chip
                              key={s}
                              label={s.charAt(0).toUpperCase() + s.slice(1)}
                              size="small"
                              color="primary"
                              sx={{ width: 'fit-content', fontWeight: 600 }}
                            />
                          ))}
                        </Stack>
                        {field.price && field.price > 0 && (
                          <Typography variant="body2" color="primary.main" fontWeight={600}>
                            Cena: {field.price} EUR
                          </Typography>
                        )}
                        {userLocation && (
                          <Typography variant="body2" color="text.secondary">
                            Udaljenost: {getDistance(
                              userLocation[0],
                              userLocation[1],
                              field.lat,
                              field.lng
                            ).toFixed(1)} km
                          </Typography>
                        )}

                        {reservedMatches.length > 0 && (
                          <>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2" fontWeight={600}>
                              Rezervisani termini ({reservedMatches.length}):
                            </Typography>
                            <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                              {reservedMatches.map((match) => (
                                <Box
                                  key={match._id}
                                  sx={{
                                    p: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    bgcolor: 'action.hover',
                                  }}
                                >
                                  <Typography variant="body2" fontWeight={600}>
                                    {new Date(match.dateTime).toLocaleString('sr-RS', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatPlayersCount(match)} igrača
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </>
                        )}

                        {activeMatches.length > 0 && (
                          <>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2" fontWeight={600}>
                              Aktivni mečevi ({activeMatches.length}):
                            </Typography>
                            <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                              {activeMatches.map((match) => (
                                <Box
                                  key={match._id}
                                  sx={{
                                    p: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                  }}
                                >
                                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                    <Chip
                                      label={formatPlayersCount(match)}
                                      size="small"
                                      color={match.status === 'full' ? 'warning' : 'primary'}
                                    />
                                    <Chip
                                      label={match.courtApproval === 'pending' ? 'Na čekanju' : translateMatchStatus(match.status)}
                                      size="small"
                                      color={match.courtApproval === 'pending' ? 'default' : 'success'}
                                    />
                                  </Stack>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    component={Link}
                                    to={`/matches/${match._id}`}
                                    fullWidth
                                  >
                                    Detalji
                                  </Button>
                                </Box>
                              ))}
                            </Stack>
                          </>
                        )}

                        {user && user.role === 'player' && (
                          <Button
                            variant="contained"
                            fullWidth
                            component={Link}
                            to={`/create?fieldId=${field._id}`}
                            sx={{ mt: 1 }}
                          >
                            Kreiraj meč
                          </Button>
                        )}
                      </Stack>
                    </Popup>
                  </Marker>
                );
              })}

            {/* Match markers */}
            {(() => {
              const matchesByField = new Map<string, Match[]>();
              displayedMatches
                .filter((match) =>
                  match.fieldId &&
                  match.fieldId.lat &&
                  match.fieldId.lng &&
                  isToday(match.dateTime)
                )
                .forEach((match) => {
                  const fieldId = match.fieldId!._id;
                  if (!matchesByField.has(fieldId)) {
                    matchesByField.set(fieldId, []);
                  }
                  matchesByField.get(fieldId)!.push(match);
                });

              return Array.from(matchesByField.entries()).map(([fieldId, fieldMatches]) => {
                const firstMatch = fieldMatches[0];
                const field = firstMatch.fieldId!;

                return (
                  <Marker
                    key={`field-matches-${fieldId}`}
                    position={[field.lat, field.lng]}
                    icon={matchIcon}
                  >
                    <Popup>
                      <Stack spacing={2} sx={{ minWidth: 0, width: '100%', maxWidth: 'min(360px, 78vw)', maxHeight: 400, overflowY: 'auto' }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {field.name || 'Nepoznat Teren'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {fieldMatches.length} meč{fieldMatches.length !== 1 ? 'eva' : ''} na ovom terenu
                        </Typography>

                        <Stack spacing={1.5}>
                          {fieldMatches.map((match) => (
                            <Box
                              key={match._id}
                              sx={{
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                              }}
                            >
                              <Stack spacing={1}>
                                <Typography variant="body2" fontWeight={600}>
                                  {getGameTypeName(match.sport)} meč
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(match.dateTime).toLocaleString('sr-RS', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                  <Chip
                                    label={formatPlayersCount(match)}
                                    size="small"
                                    color={match.status === 'full' ? 'warning' : 'primary'}
                                  />
                                </Stack>
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    component={Link}
                                    to={`/matches/${match._id}`}
                                    fullWidth
                                  >
                                    Detalji
                                  </Button>
                                  {!isUserInMatch(match) && user?.role !== 'court' && (
                                    !user ? (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        component={Link}
                                        to="/login"
                                        fullWidth
                                      >
                                        Prijavi se
                                      </Button>
                                    ) : isUserOnWaitlist(match) ? (
                                      <Button
                                        variant="outlined"
                                        color="warning"
                                        size="small"
                                        component={Link}
                                        to={`/matches/${match._id}`}
                                        fullWidth
                                      >
                                        Na listi
                                      </Button>
                                    ) : match.players.length >= (match.maxPlayers || 100) ? (
                                      <Button
                                        variant="contained"
                                        color="warning"
                                        size="small"
                                        onClick={() => handleJoinWaitlist(match._id)}
                                        fullWidth
                                      >
                                        Stani u red
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        onClick={() => handleJoinMatch(match._id)}
                                        fullWidth
                                      >
                                        Pridruži se
                                      </Button>
                                    )
                                  )}
                                </Stack>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Stack>
                    </Popup>
                  </Marker>
                );
              });
            })()}
            {/* Informal match markers — show all upcoming, not just today */}
            {displayedMatches
              .filter((match) =>
                match.isInformal &&
                match.informalLocation?.lat &&
                match.informalLocation?.lng &&
                new Date(match.dateTime) > new Date()
              )
              .map((match) => (
                <Marker
                  key={`informal-${match._id}`}
                  position={[match.informalLocation!.lat, match.informalLocation!.lng]}
                  icon={informalMatchIcon}
                >
                  <Popup>
                    <Stack spacing={1.5} sx={{ minWidth: 0, width: '100%', maxWidth: 'min(320px, 78vw)' }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 0, wordBreak: 'break-word' }}>
                          {match.informalLocation!.name || 'Privatni teren'}
                        </Typography>
                        <Chip label="Privatni" size="small" sx={{ bgcolor: '#f97316', color: 'white', fontWeight: 600 }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {getGameTypeName(match.sport)} meč
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(match.dateTime).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip label={formatPlayersCount(match)} size="small" color={match.status === 'full' ? 'warning' : 'primary'} />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button variant="outlined" size="small" component={Link} to={`/matches/${match._id}`} fullWidth>
                          Detalji
                        </Button>
                        {!isUserInMatch(match) && user?.role !== 'court' && (
                          !user ? (
                            <Button variant="contained" size="small" component={Link} to="/login" fullWidth>
                              Prijavi se
                            </Button>
                          ) : isUserOnWaitlist(match) ? (
                            <Button variant="outlined" color="warning" size="small" component={Link} to={`/matches/${match._id}`} fullWidth>
                              Na listi
                            </Button>
                          ) : match.players.length >= (match.maxPlayers || 100) ? (
                            <Button variant="contained" color="warning" size="small" onClick={() => handleJoinWaitlist(match._id)} fullWidth>
                              Stani u red
                            </Button>
                          ) : (
                            <Button variant="contained" size="small" onClick={() => handleJoinMatch(match._id)} fullWidth>
                              Pridruži se
                            </Button>
                          )
                        )}
                      </Stack>
                    </Stack>
                  </Popup>
                </Marker>
              ))
            }
          </MapContainer>
        </Box>
      </Paper>
      )}

      {/* Floating Action Button for creating matches */}
      {user && user.role === 'player' && (
        <Fab
          color="primary"
          aria-label="Kreiraj meč"
          onClick={() => navigate('/create')}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
            zIndex: 1200,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}
