import { useEffect, useState } from 'react';
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
  IconButton,
  Tooltip,
  Fab,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match, Field } from '../types';
import { useAuth } from '../context/AuthContext';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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

const matchIcon = createCustomIcon('#22c55e'); // Green for formal matches
const fieldIcon = createCustomIcon('#3b82f6'); // Blue for fields
const informalMatchIcon = createCustomIcon('#f97316'); // Orange for informal matches

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

// Match Card Component
function MatchCard({
  match,
  user,
  isUserInMatch,
  onJoin,
  userLocation,
}: {
  match: Match;
  user: any;
  isUserInMatch: boolean;
  onJoin: (id: string) => void;
  userLocation: [number, number] | null;
}) {
  const navigate = useNavigate();

  const getStatusColor = () => {
    if (match.status === 'full') return 'warning';
    if (match.courtApproval === 'pending') return 'default';
    return 'success';
  };

  const getStatusLabel = () => {
    if (match.courtApproval === 'pending') return 'Na čekanju';
    if (match.status === 'full') return 'Pun';
    return 'Otvoren';
  };

  const isLastMinute = (() => {
    const startsInMs = new Date(match.dateTime).getTime() - Date.now();
    const freeSlots = (match.maxPlayers || match.playersNeeded || 100) - match.players.length;
    return startsInMs > 0 && startsInMs <= 4 * 60 * 60 * 1000 && freeSlots > 0;
  })();

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
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <SportsSoccerIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {match.sport}
                </Typography>
              </Stack>
              <Typography variant="subtitle1" fontWeight={700}>
                {match.isInformal
                  ? (match.informalLocation?.name || 'Privatni teren')
                  : (typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren')}
              </Typography>
            </Box>
            {userLocation && (() => {
              const lat = match.isInformal ? match.informalLocation?.lat : (typeof match.fieldId === 'object' ? match.fieldId?.lat : undefined);
              const lng = match.isInformal ? match.informalLocation?.lng : (typeof match.fieldId === 'object' ? match.fieldId?.lng : undefined);
              if (!lat || !lng) return null;
              return (
              <Chip
                icon={<LocationOnIcon sx={{ fontSize: 14 }} />}
                label={`${getDistance(
                  userLocation[0],
                  userLocation[1],
                  lat,
                  lng
                ).toFixed(1)} km`}
                size="small"
                sx={{
                  bgcolor: 'action.hover',
                  fontWeight: 600,
                  '& .MuiChip-icon': {
                    color: 'text.secondary',
                  },
                }}
              />
              );
            })()}
          </Stack>

          {/* Meta info */}
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              <Typography variant="body2" color="text.secondary">
                {new Date(match.dateTime).toLocaleString('sr-RS', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <PeopleIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              <Typography variant="body2" color="text.secondary">
                {formatPlayersCount(match)} igrača
              </Typography>
            </Stack>
          </Stack>

          {/* Status and Actions */}
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1}>
              <Chip
                label={getStatusLabel()}
                size="small"
                color={getStatusColor() as any}
                sx={{ fontWeight: 600 }}
              />
              {isLastMinute && (
                <Chip
                  label="Last Minute"
                  size="small"
                  color="error"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {isUserInMatch && (
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                  label="Pridružen"
                  size="small"
                  color="success"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>

            <Button
              variant="contained"
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/matches/${match._id}`)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Detalji
            </Button>
          </Stack>

          {/* Join button for non-members - allow joining until maxPlayers is reached */}
          {user && !isUserInMatch && user.role !== 'court' && (
            <Button
              variant="outlined"
              fullWidth
              onClick={() => onJoin(match._id)}
              disabled={match.players.length >= (match.maxPlayers || match.playersNeeded || 100)}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              {match.players.length >= (match.maxPlayers || match.playersNeeded || 100) 
                ? 'Meč je pun' 
                : 'Pridruži se meču'}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allFieldMatches, setAllFieldMatches] = useState<Record<string, Match[]>>({});
  const [fields, setFields] = useState<Field[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Use user's notification radius if available (convert km to meters for map), default 10km
  const effectiveRadius = user?.notificationRadius || 10;

  const defaultCenter: [number, number] = [44.7866, 20.4489]; // Belgrade as default
  const mapCenter = userLocation || defaultCenter;

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
      const res = await api.post(`/api/matches/${matchId}/join`);
      const updatedMatch = res.data;

      const updatedAllMatches = allMatches.map(m => m._id === matchId ? updatedMatch : m);
      setAllMatches(updatedAllMatches);

      if (updatedMatch.fieldId) {
        const fieldId = typeof updatedMatch.fieldId === 'object' ? updatedMatch.fieldId._id : updatedMatch.fieldId;
        setAllFieldMatches(prev => {
          const updated = { ...prev };
          if (!updated[fieldId]) {
            updated[fieldId] = [];
          }
          const fieldMatches = updated[fieldId];
          const matchIndex = fieldMatches.findIndex(m => m._id === matchId);
          if (matchIndex >= 0) {
            fieldMatches[matchIndex] = updatedMatch;
          } else {
            if (updatedMatch.status !== 'otkazano' && updatedMatch.courtApproval !== 'rejected') {
              fieldMatches.push(updatedMatch);
            }
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
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Neuspešno pridruživanje meču';
      alert(errorMsg);
    }
  }

  function isUserInMatch(match: Match): boolean {
    if (!user) return false;
    return match.players.some(p => p._id === user._id);
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

  const formatDateTimeForURL = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = '00';
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const todaysMatches = matches.filter(m => isToday(m.dateTime));
  const upcomingInformalMatches = matches
    .filter((m) => m.isInformal && m.informalLocation?.lat && m.informalLocation?.lng)
    .filter((m) => (m.status === 'open' || m.status === 'full') && m.courtApproval !== 'rejected')
    .filter((m) => new Date(m.dateTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          {user ? 'Današnji mečevi' : 'Sportski tereni'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {user
            ? `Pronađite mečeve u vašoj blizini${userLocation ? ` (unutar ${effectiveRadius}km)` : ''}`
            : 'Pregledajte dostupne terene i prijavite se da biste se pridružili mečevima'}
        </Typography>
      </Box>

      {/* Alerts */}
      {!user && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 3 }}
          icon={<InfoIcon />}
        >
          Možete videti sve dostupne terene.{' '}
          <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>
            Prijavite se
          </Link>{' '}
          da biste videli mečeve i kreirali nove.
        </Alert>
      )}
      {locationError && user && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
          {locationError}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* No matches alert */}
      {!loading && user && matches.length === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 3 }}>
          Nema aktivnih mečeva unutar {effectiveRadius}km. Proširite pretragu ili kreirajte novi meč!
        </Alert>
      )}

      {/* Map Section */}
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
        <Box sx={{ height: { xs: '50vh', md: '60vh' } }}>
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
                      <Stack spacing={1.5} sx={{ minWidth: 280, maxWidth: 360 }}>
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
                                      label={match.courtApproval === 'pending' ? 'Na čekanju' : match.status}
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
              matches
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
                      <Stack spacing={2} sx={{ minWidth: 280, maxHeight: 400, overflowY: 'auto' }}>
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
                                  {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} Meč
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
                                  {match.players.length < (match.maxPlayers || match.playersNeeded || 100) && !isUserInMatch(match) && user?.role !== 'court' && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleJoinMatch(match._id)}
                                      fullWidth
                                    >
                                      Pridruži se
                                    </Button>
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
            {allMatches
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
                    <Stack spacing={1.5} sx={{ minWidth: 240 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={700}>
                          {match.informalLocation!.name || 'Privatni teren'}
                        </Typography>
                        <Chip label="Privatni" size="small" sx={{ bgcolor: '#f97316', color: 'white', fontWeight: 600 }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} meč
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(match.dateTime).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip label={formatPlayersCount(match)} size="small" color={match.status === 'full' ? 'warning' : 'primary'} />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" component={Link} to={`/matches/${match._id}`} fullWidth>
                          Detalji
                        </Button>
                        {match.players.length < (match.maxPlayers || match.playersNeeded || 100) && !isUserInMatch(match) && user?.role !== 'court' && (
                          <Button variant="contained" size="small" onClick={() => handleJoinMatch(match._id)} fullWidth>
                            Pridruži se
                          </Button>
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

      {/* Match Cards Section */}
      {upcomingInformalMatches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Privatni mečevi u blizini
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {upcomingInformalMatches.slice(0, 6).map((match) => (
              <MatchCard
                key={match._id}
                match={match}
                user={user}
                isUserInMatch={isUserInMatch(match)}
                onJoin={handleJoinMatch}
                userLocation={userLocation}
              />
            ))}
          </Box>
        </Box>
      )}
      {todaysMatches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Današnji mečevi u blizini
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {todaysMatches.slice(0, 6).map((match) => (
              <MatchCard
                key={match._id}
                match={match}
                user={user}
                isUserInMatch={isUserInMatch(match)}
                onJoin={handleJoinMatch}
                userLocation={userLocation}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Floating Action Button for creating matches */}
      {user && user.role === 'player' && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => navigate('/create')}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}
