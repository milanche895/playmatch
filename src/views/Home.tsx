'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from '@/lib/router';
import {
  ButtonBase,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, AttributionControl } from 'react-leaflet';
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
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SegmentedControl from '../components/ui/SegmentedControl';
import FilterSheet, { type HomeScope } from '../components/FilterSheet';
import SportIcon from '../components/SportIcon';
import PlayerAvatarStack from '../components/PlayerAvatarStack';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { createSportPin, createFieldPin } from '../components/mapPins';
import {
  getGameTypeName,
  matchBelongsToPreferredGames,
} from '../constants/games';
import { formatPlayersCount } from '../lib/matchPlayers';

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

// Center the map on the user and zoom so the whole search radius is visible.
// `bottomInset` reserves room for UI overlaying the map (floating match card, bottom nav).
function MapCenter({
  position,
  radiusKm,
  bottomInset,
  trigger,
}: {
  position: [number, number];
  radiusKm: number;
  bottomInset: number;
  trigger: number | null;
}) {
  const map = useMap();
  const [lat, lng] = position;
  useEffect(() => {
    map.invalidateSize();
    const size = map.getSize();
    // Never reserve more than ~45% of the map height
    const bottom = Math.min(bottomInset, Math.round(size.y * 0.45));
    // Zoom so the radius fits the map WIDTH (height is partly covered by the floating card)
    const bounds = L.latLng(lat, lng).toBounds(radiusKm * 2000);
    const wide = L.latLngBounds([lat, bounds.getWest()], [lat, bounds.getEast()]);
    const zoom = Math.min(15, Math.max(9, map.getBoundsZoom(wide, false, L.point(24, 0))));
    // Put the user in the middle of the part of the map that stays visible above the overlay
    const center = map.unproject(map.project([lat, lng], zoom).add([0, bottom / 2]), zoom);
    map.setView(center, zoom, { animate: false });
  }, [map, lat, lng, radiusKm, bottomInset, trigger]);
  return null;
}

// Keep Leaflet in sync when the map container is resized (e.g. mobile full-height map)
function MapResizer({ trigger }: { trigger: number | null }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, trigger]);
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

function formatRelativeMatchTime(dateTimeString: string): string {
  const matchDate = new Date(dateTimeString);
  const now = new Date();
  const timeStr = matchDate.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
  const dayDiff = Math.round((startOfMatchDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return `Danas · ${timeStr}`;
  if (dayDiff === 1) return `Sutra · ${timeStr}`;
  if (dayDiff === -1) return `Juče · ${timeStr}`;

  const dateStr = matchDate.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
  return `${dateStr} · ${timeStr}`;
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

function getSpotsLeft(match: Match): number {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded ?? 0;
  const target = match.maxPlayers || min;
  return Math.max(0, target - current);
}

function formatSpotsLabel(remaining: number): string {
  if (remaining === 0) return 'Popunjeno';
  const lastTwo = remaining % 100;
  const last = remaining % 10;
  if (last === 1 && lastTwo !== 11) return `${remaining} mesto`;
  return `${remaining} mesta`;
}

function formatPlayerNames(names: string[]): string {
  const formatted = names.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1)));
  if (formatted.length <= 1) return formatted.join('');
  return `${formatted.slice(0, -1).join(', ')} i ${formatted[formatted.length - 1]}`;
}

// Shared button geometry for the card action (primary = solid blue, secondary = light blue)
const cardActionSx = {
  flexShrink: 0,
  minWidth: 108,
  height: 42,
  px: '18px',
  borderRadius: '11px',
  fontSize: 15,
  fontWeight: 600,
  whiteSpace: 'nowrap',
} as const;

const cardActionSecondarySx = {
  ...cardActionSx,
  color: 'primary.main',
  bgcolor: '#EEF5FF',
  border: '1px solid #B9D4FB',
  '&:hover': { bgcolor: '#E2EEFF', borderColor: '#9CC4FA', boxShadow: 'none' },
} as const;

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

type MapGroup = { key: string; lat: number; lng: number; matches: Match[] };

const VIEW_MODE_KEY = 'playmatch_home_view';
const SPORT_FILTER_KEY = 'playmatch_home_sport_filter';
const RADIUS_KEY = 'playmatch_home_radius';

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
  highlightTour,
  elevated,
}: {
  match: Match;
  user: any;
  isUserInMatch: boolean;
  isOnWaitlist: boolean;
  onJoin: (id: string) => void;
  onJoinWaitlist: (id: string) => void;
  userLocation: [number, number] | null;
  joiningId?: string | null;
  highlightTour?: boolean;
  /** Floating variant (map bottom card): adds a soft shadow. */
  elevated?: boolean;
}) {
  const navigate = useNavigate();
  const isFull = match.players.length >= (match.maxPlayers || 100);
  const isJoining = joiningId === match._id;
  const spotsLeft = getSpotsLeft(match);
  const detailsPath = `/matches/${match._id}`;

  const coords = getMatchCoords(match);
  const locationName = getMatchLocationName(match);
  const distanceKm =
    userLocation && coords
      ? getDistance(userLocation[0], userLocation[1], coords.lat, coords.lng)
      : null;
  const locationLine =
    distanceKm != null
      ? `${locationName} · ${distanceKm.toFixed(1).replace('.', ',')} km`
      : locationName;

  // Secondary state badge (top-right) — only for states the list needs to surface
  const stateBadge = isUserInMatch
    ? { label: 'Pridružen', color: '#0F9D58', bg: '#E6F6EC' }
    : isOnWaitlist
      ? { label: 'Na listi čekanja', color: '#B45309', bg: '#FEF3E2' }
      : match.courtApproval === 'pending'
        ? { label: 'Na čekanju', color: '#6B7A99', bg: '#EEF2F8' }
        : null;

  const stop = (e: MouseEvent<HTMLElement>) => e.stopPropagation();

  let action: JSX.Element;
  if (isUserInMatch || user?.role === 'court') {
    action = (
      <Button
        variant="outlined"
        onClick={(e) => { stop(e); navigate(detailsPath); }}
        sx={cardActionSecondarySx}
      >
        Detalji
      </Button>
    );
  } else if (isOnWaitlist) {
    action = (
      <Button
        variant="outlined"
        onClick={(e) => { stop(e); navigate(detailsPath); }}
        sx={cardActionSecondarySx}
      >
        Na listi
      </Button>
    );
  } else if (isFull) {
    action = (
      <Button
        variant="contained"
        disabled={isJoining}
        onClick={(e) => { stop(e); onJoinWaitlist(match._id); }}
        sx={cardActionSx}
      >
        {isJoining ? 'Prijavljivanje...' : 'Stani u red'}
      </Button>
    );
  } else {
    action = (
      <Button
        variant="contained"
        disabled={isJoining}
        onClick={(e) => { stop(e); onJoin(match._id); }}
        sx={cardActionSx}
      >
        {isJoining ? 'Prijavljivanje...' : 'Prijavi se'}
      </Button>
    );
  }

  return (
    <Box
      component="article"
      role="link"
      tabIndex={0}
      aria-label={`${getGameTypeName(match.sport)} — ${locationName}`}
      data-tour={highlightTour ? 'tour-match-card' : undefined}
      onClick={() => navigate(detailsPath)}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          navigate(detailsPath);
        }
      }}
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #E3E9F3',
        borderRadius: '16px',
        p: '16px',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: elevated ? '0 8px 24px rgba(11, 27, 63, 0.16)' : 'none',
        '&:focus-visible': { borderColor: 'primary.main' },
      }}
    >
      <Stack direction="row" spacing="12px" alignItems="flex-start">
        <Box sx={{ pt: '2px' }}>
          <SportIcon sport={match.sport} size={46} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
            <Typography
              component="h3"
              noWrap
              sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: '#0B1B3F', minWidth: 0 }}
            >
              {getGameTypeName(match.sport)}
            </Typography>
            {stateBadge && (
              <Box
                sx={{
                  flexShrink: 0,
                  px: '8px',
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '7px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: stateBadge.color,
                  bgcolor: stateBadge.bg,
                }}
              >
                {stateBadge.label}
              </Box>
            )}
          </Stack>
          <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: '#0B1B3F', mt: '1px' }}>
            {formatRelativeMatchTime(match.dateTime)}
          </Typography>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 400, lineHeight: 1.4, color: '#6B7A99' }}>
            {locationLine}
          </Typography>
        </Box>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing="8px"
        sx={{ mt: '12px' }}
      >
        <Stack direction="row" alignItems="center" spacing="8px" sx={{ minWidth: 0 }}>
          <PlayerAvatarStack players={match.players} size={30} />
          <Box
            sx={{
              flexShrink: 0,
              px: '10px',
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '8px',
              fontSize: 13,
              fontWeight: 600,
              color: spotsLeft > 0 ? '#E5484D' : '#6B7A99',
              bgcolor: spotsLeft > 0 ? '#FDECEC' : '#EEF2F8',
            }}
          >
            {formatSpotsLabel(spotsLeft)}
          </Box>
        </Stack>
        {action}
      </Stack>
    </Box>
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
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'map' || saved === 'list') return saved;
    return 'list';
  });
  const [sportFilter, setSportFilter] = useState<HomeScope>(() => {
    const saved = localStorage.getItem(SPORT_FILTER_KEY);
    if (saved === 'mine' || saved === 'preferred' || saved === 'all') return saved;
    return 'all';
  });
  const [radiusOverride, setRadiusOverride] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(RADIUS_KEY));
    return saved >= 1 && saved <= 50 ? Math.round(saved) : null;
  });
  const [filterOpen, setFilterOpen] = useState(false);

  const preferredSports = user?.preferredSports || [];
  const hasPreferences = preferredSports.length > 0;

  // Use user's notification radius if available (convert km to meters for map), default 10km
  const effectiveRadius = radiusOverride ?? (user?.notificationRadius || 10);

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
    // Last saved position lets the map open in the right place immediately,
    // and is the fallback when the browser can't provide a fresh fix.
    const cached = user?.lastKnownLocation;
    const cachedLocation: [number, number] | null =
      cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng)
        ? [cached.lat, cached.lng]
        : null;
    if (cachedLocation) {
      setUserLocation((prev) => prev || cachedLocation);
    }

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
          // Expected condition (denied/unavailable/timeout) - warn, don't trigger the dev error overlay
          console.warn(`Geolocation error (code ${error.code}): ${error.message}`);
          let errorMessage = 'Nije moguće dobiti vašu lokaciju. Prikazuju se svi mečevi.';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Dozvola za lokaciju je odbijena. Molimo omogućite pristup lokaciji u postavkama vašeg pretraživača.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Informacije o lokaciji nisu dostupne.';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'Zahtev za lokaciju je istekao.';
          }
          if (!cachedLocation) setLocationError(errorMessage);
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
  }, [userLocation, allMatches, effectiveRadius]);

  async function handleJoinMatch(matchId: string) {
    if (!user) {
      navigate('/login?from=/');
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
      navigate('/login?from=/');
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
    if (!user || user.role !== 'player' || sportFilter === 'all') return matches;
    if (sportFilter === 'mine') {
      return matches.filter((m) => {
        const creatorId = typeof m.createdBy === 'object' ? m.createdBy?._id : m.createdBy;
        return creatorId === user._id || m.players.some((p) => p._id === user._id);
      });
    }
    if (!hasPreferences) return matches;
    return matches.filter((m) => matchBelongsToPreferredGames(m.sport, preferredSports));
  }, [matches, hasPreferences, sportFilter, preferredSports, user]);

  const upcomingMatches = [...displayedMatches]
    .filter((m) => new Date(m.dateTime).getTime() > Date.now() - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const handleViewModeChange = (next: 'list' | 'map') => {
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleFilterApply = (scope: HomeScope, radiusKm: number) => {
    setSportFilter(scope);
    localStorage.setItem(SPORT_FILTER_KEY, scope);
    setRadiusOverride(radiusKm);
    localStorage.setItem(RADIUS_KEY, String(radiusKm));
  };

  const isPlayer = user?.role === 'player';
  const hasBottomNav = isMobile && isPlayer;
  const mobileMap = isMobile && viewMode === 'map';

  // Map: one pin per location (field or private spot); tapping a pin shows its match card(s)
  const mapGroups: MapGroup[] = [];
  {
    const byKey = new Map<string, MapGroup>();
    upcomingMatches.forEach((m) => {
      const c = getMatchCoords(m);
      if (!c) return;
      const key = m.isInformal ? `i-${m._id}` : `f-${m.fieldId?._id}`;
      const existing = byKey.get(key);
      if (existing) existing.matches.push(m);
      else byKey.set(key, { key, lat: c.lat, lng: c.lng, matches: [m] });
    });
    byKey.forEach((g) => mapGroups.push(g));
  }
  const selectedGroup = mapGroups.find((g) => g.key === selectedGroupKey) ?? mapGroups[0] ?? null;

  // Mobile map fills the screen below the filters (down to the bottom edge, under the nav)
  const mapBoxRef = useRef<HTMLDivElement | null>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!mobileMap) return;
    const update = () => {
      const el = mapBoxRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(360, Math.round(window.innerHeight - top));
      setMapHeight((prev) => (prev === next ? prev : next));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  const subtitle = (() => {
    if (isPlayer && sportFilter === 'mine') {
      return userLocation ? `Moje igre · do ${effectiveRadius} km` : 'Moje igre';
    }
    if (isPlayer && hasPreferences && sportFilter === 'preferred') {
      const names = formatPlayerNames(preferredSports.map(getGameTypeName));
      return userLocation ? `${names} · do ${effectiveRadius} km` : names;
    }
    if (isPlayer) {
      return userLocation ? `Sve igre · do ${effectiveRadius} km` : 'Sve igre';
    }
    if (user) {
      return `Pronađite mečeve u vašoj blizini${userLocation ? ` (unutar ${effectiveRadius} km)` : ''}`;
    }
    return 'Pregledajte dostupne mečeve i terene. Prijavite se da biste se pridružili meču.';
  })();

  return (
    <Box
      sx={{
        position: 'relative',
        px: { xs: '10px', md: 0 },
        pb: isPlayer ? (isMobile ? (mobileMap ? 0 : '64px') : 8) : 0,
      }}
    >
      {/* Header Section */}
      <Box sx={{ mb: '16px', pt: '4px' }}>
        <Box data-tour="tour-home-heading" sx={{ mb: '16px' }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 24, md: 28 },
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              mb: '4px',
            }}
          >
            Mečevi u blizini
          </Typography>
          <ButtonBase
            onClick={() => setFilterOpen(true)}
            data-tour="tour-sport-filter"
            aria-label={`Filteri: ${subtitle}`}
            aria-haspopup="dialog"
            disableRipple
            sx={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px 10px',
              textAlign: 'left',
              borderRadius: '6px',
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, color: 'text.secondary' }}>
              {subtitle}
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.45,
                color: 'primary.main',
              }}
            >
              <TuneIcon sx={{ fontSize: 18 }} />
              Filteri
            </Box>
          </ButtonBase>
        </Box>

        <Stack spacing="12px" sx={{ maxWidth: { md: 420 } }}>
          <SegmentedControl
            data-tour="tour-view-mode"
            value={viewMode}
            onChange={handleViewModeChange}
            options={[
              { value: 'list', label: 'Lista', ariaLabel: 'Prikaz liste' },
              { value: 'map', label: 'Mapa', ariaLabel: 'Prikaz mape' },
            ]}
          />
        </Stack>
      </Box>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        scope={sportFilter}
        radiusKm={Math.min(50, Math.max(1, effectiveRadius))}
        showScope={isPlayer}
        showPreferred={isPlayer && hasPreferences}
        onApply={handleFilterApply}
      />

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
          {sportFilter === 'mine' && isPlayer
            ? 'Nema mečeva koje si okupio ili na koje si se prijavio. Prebaci se na „Sve“ ili kreiraj novi.'
            : user && userLocation
              ? sportFilter === 'preferred' && hasPreferences
                ? `Nema mečeva za ${preferredSports.map(getGameTypeName).join(', ')} u blizini. Prebaci se na „Sve“ ili kreiraj novi.`
                : `Nema aktivnih mečeva unutar ${effectiveRadius} km. Proširite pretragu ili kreirajte novi meč!`
              : sportFilter === 'preferred' && hasPreferences
                ? `Nema mečeva za ${preferredSports.map(getGameTypeName).join(', ')}. Prebaci se na „Sve“ ili kreiraj novi.`
                : 'Nema aktivnih mečeva u ovom trenutku.'}
        </Alert>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && upcomingMatches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: '14px',
            }}
          >
            {upcomingMatches.map((match, index) => (
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
                highlightTour={index === 0}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Map Section */}
      {!loading && viewMode === 'map' && (
      <Box
        ref={mapBoxRef}
        sx={
          isMobile
            ? {
                position: 'relative',
                isolation: 'isolate',
                overflow: 'hidden',
                mx: { xs: '-16px', sm: '-26px' },
                height: mapHeight ? `${mapHeight}px` : '60vh',
                mb: hasBottomNav
                  ? `calc(-1 * (${BOTTOM_NAV_HEIGHT + 16}px + env(safe-area-inset-bottom)))`
                  : 0,
              }
            : {
                position: 'relative',
                isolation: 'isolate',
                overflow: 'hidden',
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                mb: 4,
              }
        }
      >
        {!isMobile && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MyLocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Mapa terena
              </Typography>
            </Stack>
          </Box>
        )}
        <Box sx={{ height: isMobile ? '100%' : '60vh' }}>
          <MapContainer
            center={mapCenter}
            zoom={userLocation ? 13 : 12}
            zoomControl={!isMobile}
            attributionControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizer trigger={mapHeight} />
            {userLocation && (
              <MapCenter
                position={userLocation}
                radiusKm={effectiveRadius}
                bottomInset={isMobile ? BOTTOM_NAV_HEIGHT + 190 : 0}
                trigger={mapHeight}
              />
            )}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="plejko-map-tiles"
            />
            <AttributionControl position="topright" prefix={false} />

            {/* User location radius circle - only show when user is logged in and has location */}
            {user && userLocation && (
              <Circle
                center={userLocation}
                radius={effectiveRadius * 1000} // Convert km to meters
                pathOptions={{
                  color: '#0877F9',
                  fillColor: '#0877F9',
                  fillOpacity: 0.06,
                  weight: 1.5,
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
                    icon={createFieldPin()}
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

            {/* Match pins — one per location, colored by sport; selected pin is larger */}
            {mapGroups.map((group) => {
              const isSelected = selectedGroup?.key === group.key;
              return (
                <Marker
                  key={`group-${group.key}`}
                  position={[group.lat, group.lng]}
                  icon={createSportPin(group.matches[0].sport, isSelected)}
                  zIndexOffset={isSelected ? 1000 : 500}
                  eventHandlers={{ click: () => setSelectedGroupKey(group.key) }}
                />
              );
            })}
          </MapContainer>
        </Box>

        {/* Selected location — floating match card(s) above the bottom navigation */}
        {selectedGroup && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              zIndex: 1000,
              bottom: hasBottomNav
                ? `calc(${BOTTOM_NAV_HEIGHT + 12}px + env(safe-area-inset-bottom))`
                : '12px',
              px: '16px',
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              pointerEvents: 'none',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {selectedGroup.matches.map((match) => (
              <Box
                key={match._id}
                sx={{
                  flex: isMobile ? '0 0 100%' : '0 0 440px',
                  scrollSnapAlign: 'center',
                  pointerEvents: 'auto',
                }}
              >
                <MatchCard
                  match={match}
                  user={user}
                  isUserInMatch={isUserInMatch(match)}
                  isOnWaitlist={isUserOnWaitlist(match)}
                  onJoin={handleJoinMatch}
                  onJoinWaitlist={handleJoinWaitlist}
                  userLocation={userLocation}
                  joiningId={joiningId}
                  elevated
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
      )}

      {/* Create match CTA — on mobile it lives in the bottom navigation; round FAB on desktop */}
      {user && user.role === 'player' && !isMobile && (
        <Fab
          color="primary"
          aria-label="Kreiraj meč"
          onClick={() => navigate('/create')}
          data-tour="tour-fab-create"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}
