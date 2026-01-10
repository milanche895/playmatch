import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Paper, Typography, Stack, Button, Chip, Alert, CircularProgress, Box, Divider } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match, Field } from '../types';
import { useAuth } from '../context/AuthContext';

// Custom icons using HTML div icons for better customization
function createCustomIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
}

const matchIcon = createCustomIcon('#4caf50'); // Green for all matches
const fieldIcon = createCustomIcon('#2196f3'); // Blue for fields

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

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allFieldMatches, setAllFieldMatches] = useState<Record<string, Match[]>>({}); // All matches for each field
  const [fields, setFields] = useState<Field[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const maxDistance = 50; // Maximum distance in km

  const defaultCenter: [number, number] = [44.7866, 20.4489]; // Belgrade as default
  const mapCenter = userLocation || defaultCenter;

  useEffect(() => {
    // Get user location (try even if not logged in, for map centering)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.latitude && position.coords.longitude) {
            const location: [number, number] = [
              position.coords.latitude, 
              position.coords.longitude
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
          enableHighAccuracy: true, 
          timeout: 15000,
          maximumAge: 0 // Don't use cached position
        }
      );
    } else {
      setLocationError('Geolokacija nije podržana u vašem pretraživaču.');
    }

    // Load fields (always, for both logged in and not logged in users)
    api.get('/api/fields').then((fieldsRes) => {
      // Filter only fields with valid coordinates
      const validFields = fieldsRes.data.filter((f: Field) => 
        f.lat && f.lng
      );
      setFields(validFields);
    }).catch(() => {
      console.error('Failed to load fields');
    });

    // Load all matches (for both logged in and not logged in users)
    api.get('/api/matches').then((matchesRes) => {
      // Filter active matches (open, full - not failed, completed, or cancelled)
      const activeMatches = matchesRes.data.filter((m: Match) => 
        (m.status === 'open' || m.status === 'full') && 
        m.courtApproval !== 'rejected'
      );
      setAllMatches(activeMatches);
      setMatches(activeMatches);
      
      // Group all matches (including reserved/completed) by field for popup display
      const matchesByField: Record<string, Match[]> = {};
      matchesRes.data.forEach((match: Match) => {
        if (!match.fieldId) return;
        const fieldId = typeof match.fieldId === 'object' ? match.fieldId._id : match.fieldId;
        if (!matchesByField[fieldId]) {
          matchesByField[fieldId] = [];
        }
        // Include all matches except cancelled/rejected
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

  // Filter matches by distance when user location is available
  useEffect(() => {
    if (userLocation && allMatches.length > 0) {
      const nearbyMatches = allMatches.filter((match) => {
        // Check if fieldId exists and has valid coordinates
        if (!match.fieldId || !match.fieldId.lat || !match.fieldId.lng) {
          return false;
        }
        const distance = getDistance(
          userLocation[0],
          userLocation[1],
          match.fieldId.lat,
          match.fieldId.lng
        );
        return distance <= maxDistance;
      });
      setMatches(nearbyMatches);
    } else if (allMatches.length > 0 && !userLocation) {
      // If no location, show all matches (but filter out ones without fieldId)
      const validMatches = allMatches.filter((match) => 
        match.fieldId && match.fieldId.lat && match.fieldId.lng
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
      
      // Update all matches list
      const updatedAllMatches = allMatches.map(m => m._id === matchId ? updatedMatch : m);
      setAllMatches(updatedAllMatches);
      
      // Update allFieldMatches for map popup display
      if (updatedMatch.fieldId) {
        const fieldId = typeof updatedMatch.fieldId === 'object' ? updatedMatch.fieldId._id : updatedMatch.fieldId;
        setAllFieldMatches(prev => {
          const updated = { ...prev };
          if (!updated[fieldId]) {
            updated[fieldId] = [];
          }
          // Find and update the match in the field's matches array
          const fieldMatches = updated[fieldId];
          const matchIndex = fieldMatches.findIndex(m => m._id === matchId);
          if (matchIndex >= 0) {
            fieldMatches[matchIndex] = updatedMatch;
          } else {
            // If match not found, add it (shouldn't happen, but just in case)
            if (updatedMatch.status !== 'otkazano' && updatedMatch.courtApproval !== 'rejected') {
              fieldMatches.push(updatedMatch);
            }
          }
          return updated;
        });
      }
      
      // Filter by distance and status
      const filteredMatches = updatedAllMatches.filter((m: Match) => {
        if ((m.status !== 'open' && m.status !== 'full') || m.courtApproval === 'rejected') return false;
        // Check if fieldId exists and has valid coordinates
        if (!m.fieldId || !m.fieldId.lat || !m.fieldId.lng) return false;
        if (userLocation) {
          const distance = getDistance(
            userLocation[0],
            userLocation[1],
            m.fieldId.lat,
            m.fieldId.lng
          );
          return distance <= maxDistance;
        }
        return true;
      });
      setMatches(filteredMatches);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Neuspešno pridruživanje meču';
      alert(errorMsg);
      // Reload all matches to get updated status
      api.get('/api/matches').then((matchesRes) => {
        const activeMatches = matchesRes.data.filter((m: Match) => 
          (m.status === 'open' || m.status === 'full') && 
          m.courtApproval !== 'rejected'
        );
        setAllMatches(activeMatches);
        
        // Update allFieldMatches
        const matchesByField: Record<string, Match[]> = {};
        matchesRes.data.forEach((match: Match) => {
          if (!match.fieldId) return;
          const fieldId = typeof match.fieldId === 'object' ? match.fieldId._id : match.fieldId;
          if (!matchesByField[fieldId]) {
            matchesByField[fieldId] = [];
          }
          // Include all matches except cancelled/rejected
          if (match.status !== 'otkazano' && match.courtApproval !== 'rejected') {
            matchesByField[fieldId].push(match);
          }
        });
        setAllFieldMatches(matchesByField);
        
        // Re-apply distance filter if user location available
        if (userLocation) {
          const nearbyMatches = activeMatches.filter((m: Match) => {
            // Check if fieldId exists and has valid coordinates
            if (!m.fieldId || !m.fieldId.lat || !m.fieldId.lng) return false;
            const distance = getDistance(
              userLocation[0],
              userLocation[1],
              m.fieldId.lat,
              m.fieldId.lng
            );
            return distance <= maxDistance;
          });
          setMatches(nearbyMatches);
        } else {
          // Filter out matches without valid fieldId
          const validMatches = activeMatches.filter((m: Match) => 
            m.fieldId && m.fieldId.lat && m.fieldId.lng
          );
          setMatches(validMatches);
        }
      });
    }
  }

  function isUserInMatch(match: Match): boolean {
    if (!user) return false;
    return match.players.some(p => p._id === user._id);
  }

  function formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Check if a date is today (same day, month, year)
  function isToday(dateTimeString: string): boolean {
    const matchDate = new Date(dateTimeString);
    const today = new Date();
    
    return (
      matchDate.getDate() === today.getDate() &&
      matchDate.getMonth() === today.getMonth() &&
      matchDate.getFullYear() === today.getFullYear()
    );
  }

  // Convert ISO dateTime string to local time format for URL (YYYY-MM-DDTHH:MM)
  // This preserves the time as displayed to the user (local timezone)
  // The backend will interpret this as local time (no timezone offset)
  function formatDateTimeForURL(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    
    // Use local time methods to get the time as displayed to user
    // This ensures we send the same hour that the user sees on screen (e.g., 22:00)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = '00'; // Always round to full hour
    
    // Return in format without timezone - backend will treat as local time
    const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
    return formatted;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>
        {user ? 'Tereni i Aktivni Mečevi' : 'Sportski Tereni'}
      </Typography>
      {!user && (
        <Alert severity="info">Možete videti sve dostupne terene. Prijavite se da biste videli mečeve i kreirali nove.</Alert>
      )}
      {locationError && user && (
        <Alert severity="warning">{locationError}</Alert>
      )}
      {user && userLocation && (
        <Typography variant="body2" color="text.secondary">
          Prikaz mečeva unutar {maxDistance}km od vaše lokacije
        </Typography>
      )}
      {loading && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      )}
      {!loading && user && matches.length === 0 && (
        <Alert severity="info">Nema aktivnih mečeva unutar {maxDistance}km</Alert>
      )}
      <Paper elevation={1} sx={{ p: 0, overflow: 'hidden', height: '70vh' }}>
        <MapContainer center={mapCenter} zoom={userLocation ? 13 : 12} style={{ height: '100%', width: '100%' }}>
          {userLocation && <MapCenter position={mapCenter} />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Field markers */}
          {fields
            .filter((field) => field.lat && field.lng)
            .map((field) => {
              // Get ALL matches for this field (reserved, completed, active, etc.)
              const allMatchesForField = allFieldMatches[field._id] || [];
              // Get active matches for filtering on map
              const fieldMatches = matches.filter(m => {
                const matchFieldId = typeof m.fieldId === 'object' ? m.fieldId._id : m.fieldId;
                return matchFieldId === field._id;
              });
              
              // Filter and sort matches by date - only show today's matches
              const todayMatches = allMatchesForField.filter(m => isToday(m.dateTime));
              const sortedMatches = [...todayMatches].sort((a, b) => 
                new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
              );
              
              // Separate active and reserved/completed matches
              // Reserved matches: approved matches (open, full, or completed) - shown first
              const reservedMatches = sortedMatches.filter(m => 
                m.courtApproval === 'approved' && 
                (m.status === 'open' || m.status === 'full' || m.status === 'completed')
              );
              // Active matches: pending approval (not yet approved/rejected) - exclude already reserved
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
                    <Stack spacing={1.5} sx={{ minWidth: 250, maxWidth: 350 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {field.name}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Sport:</strong> {field.sport.charAt(0).toUpperCase() + field.sport.slice(1)}
                      </Typography>
                      {field.price && field.price > 0 && (
                        <Typography variant="body2" color="primary">
                          <strong>Cena:</strong> {field.price} RSD
                        </Typography>
                      )}
                      {userLocation && (
                        <Typography variant="body2" color="text.secondary">
                          <strong>Udaljenost:</strong> {getDistance(
                            userLocation[0],
                            userLocation[1],
                            field.lat,
                            field.lng
                          ).toFixed(1)} km
                        </Typography>
                      )}
                      
                      {/* Show all reserved matches for this field */}
                      {reservedMatches.length > 0 && (
                        <>
                          <Divider />
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                            Rezervisani termini ({reservedMatches.length}):
                          </Typography>
                          <Stack spacing={1} sx={{ maxHeight: 250, overflowY: 'auto' }}>
                            {reservedMatches.map((match) => (
                              <Box key={match._id} sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#f5f5f5' }}>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" fontSize="0.8rem" fontWeight={600}>
                                    {formatDateTime(match.dateTime)}
                                  </Typography>
                                  <Typography variant="body2" fontSize="0.75rem" color="text.secondary">
                                    {formatPlayersCount(match)} igrača
                                    {match.status === 'completed' && ' • Završeno'}
                                  </Typography>
                                  {match.description && (
                                    <Typography variant="body2" fontSize="0.75rem" color="text.secondary" fontStyle="italic">
                                      {match.description}
                                    </Typography>
                                  )}
                                  {user && user.role === 'player' && (
                                    <Button 
                                      variant="outlined" 
                                      size="small"
                                      component={Link}
                                      to={`/create?fieldId=${field._id}&dateTime=${encodeURIComponent(formatDateTimeForURL(match.dateTime))}`}
                                      fullWidth
                                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                                    >
                                      Kreiraj novi termin
                                    </Button>
                                  )}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </>
                      )}
                      
                      {/* Show active matches for this field */}
                      {activeMatches.length > 0 && (
                        <>
                          <Divider />
                          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                            Aktivni mečevi ({activeMatches.length}):
                          </Typography>
                          <Stack spacing={1} sx={{ maxHeight: 250, overflowY: 'auto' }}>
                            {activeMatches.map((match) => (
                              <Box key={match._id} sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" fontSize="0.8rem" fontWeight={600}>
                                    {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} Meč
                                  </Typography>
                                  <Typography variant="body2" fontSize="0.75rem">
                                    <strong>Datum:</strong> {formatDateTime(match.dateTime)}
                                  </Typography>
                                  <Typography variant="body2" fontSize="0.75rem" color="text.secondary">
                                    <strong>Rok za prijavu:</strong> {formatDateTime(match.registrationDeadline)}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                    <Chip 
                                      label={formatPlayersCount(match)}
                                      size="small"
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                      color={match.status === 'full' ? 'warning' : match.status === 'failed' ? 'default' : 'primary'}
                                    />
                                    <Chip 
                                      label={match.courtApproval === 'pending' ? 'Na čekanju' : match.status === 'full' ? 'Pun' : match.status === 'open' ? 'Otvoren' : match.status}
                                      size="small"
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                      color={
                                        match.courtApproval === 'pending' ? 'default' :
                                        match.status === 'full' ? 'warning' : 
                                        match.status === 'failed' ? 'error' : 
                                        'success'
                                      }
                                    />
                                  </Stack>
                                  <Button 
                                    variant="outlined" 
                                    size="small" 
                                    component={Link} 
                                    to={`/matches/${match._id}`}
                                    fullWidth
                                    sx={{ mt: 0.5, fontSize: '0.75rem' }}
                                  >
                                    Detalji
                                  </Button>
                                  {!user && (
                                    <Button 
                                      variant="contained" 
                                      size="small"
                                      component={Link}
                                      to="/login"
                                      fullWidth
                                      sx={{ mt: 0.5, fontSize: '0.75rem' }}
                                    >
                                      Prijavi se da se pridružiš
                                    </Button>
                                  )}
                                  {user && match.status !== 'full' && !isUserInMatch(match) && user.role !== 'court' && (
                                    <Button 
                                      variant="contained" 
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleJoinMatch(match._id);
                                      }}
                                      fullWidth
                                      sx={{ mt: 0.5, fontSize: '0.75rem' }}
                                    >
                                      Pridruži se
                                    </Button>
                                  )}
                                  {user && isUserInMatch(match) && (
                                    <Chip label="Pridružen" color="success" size="small" sx={{ mt: 0.5, fontSize: '0.7rem', height: 24 }} />
                                  )}
                                  {user && user.role === 'player' && (
                                    <Button 
                                      variant="outlined" 
                                      size="small"
                                      component={Link}
                                      to={`/create?fieldId=${field._id}`}
                                      fullWidth
                                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                                    >
                                      Kreiraj novi termin
                                    </Button>
                                  )}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </>
                      )}
                      
                      {reservedMatches.length === 0 && activeMatches.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Nema rezervisanih termina
                        </Typography>
                      )}
                      
                      <Divider />
                      
                      {user && user.role === 'player' && (
                        <Button 
                          variant="contained" 
                          size="small"
                          component={Link}
                          to={`/create?fieldId=${field._id}`}
                          fullWidth
                          sx={{ mt: 0.5 }}
                        >
                          Kreiraj Novi Meč
                        </Button>
                      )}
                      {!user && (
                        <Button 
                          variant="outlined" 
                          size="small"
                          component={Link}
                          to="/login"
                          fullWidth
                          sx={{ mt: 0.5 }}
                        >
                          Prijavi se da kreiraš meč
                        </Button>
                      )}
                    </Stack>
                  </Popup>
                </Marker>
              );
            })}

          {/* Match markers - grouped by field */}
          {(() => {
            // Group matches by field - only today's matches
            const matchesByField = new Map<string, Match[]>();
            matches
              .filter((match) => 
                match.fieldId && 
                match.fieldId.lat && 
                match.fieldId.lng &&
                isToday(match.dateTime)
              )
              .forEach((match) => {
                const fieldId = match.fieldId._id;
                if (!matchesByField.has(fieldId)) {
                  matchesByField.set(fieldId, []);
                }
                matchesByField.get(fieldId)!.push(match);
              });

            // Create one marker per field showing all matches
            return Array.from(matchesByField.entries()).map(([fieldId, fieldMatches]) => {
              const firstMatch = fieldMatches[0];
              const field = firstMatch.fieldId;
              
              return (
                <Marker 
                  key={`field-matches-${fieldId}`}
                  position={[field.lat, field.lng]}
                  icon={matchIcon}
                >
                  <Popup>
                    <Stack spacing={2} sx={{ minWidth: 250, maxHeight: 400, overflowY: 'auto' }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {field.name || 'Nepoznat Teren'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {fieldMatches.length} meč{fieldMatches.length !== 1 ? 'eva' : ''} na ovom terenu
                      </Typography>
                      {userLocation && field.lat && field.lng && (
                        <Typography variant="body2" color="primary">
                          <strong>Udaljenost:</strong> {getDistance(
                            userLocation[0],
                            userLocation[1],
                            field.lat,
                            field.lng
                          ).toFixed(1)} km
                        </Typography>
                      )}
                      
                      {user && user.role === 'player' && (
                        <Button 
                          variant="contained" 
                          size="small"
                          component={Link}
                          to={`/create?fieldId=${fieldId}`}
                          fullWidth
                          sx={{ mt: 0.5, fontSize: '0.875rem' }}
                        >
                          Kreiraj Meč
                        </Button>
                      )}
                      {!user && (
                        <Button 
                          variant="outlined" 
                          size="small"
                          component={Link}
                          to="/login"
                          fullWidth
                          sx={{ mt: 0.5 }}
                        >
                          Prijavi se da kreiraš meč
                        </Button>
                      )}
                      
                      <Divider />
                      {fieldMatches.map((match) => (
                        <Box key={match._id} sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                          <Stack spacing={1}>
                            <Typography variant="body2" fontWeight={600}>
                              {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} Meč
                            </Typography>
                            <Typography variant="body2">
                              <strong>Datum:</strong> {formatDateTime(match.dateTime)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Rok za prijavu:</strong> {formatDateTime(match.registrationDeadline)}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip 
                                label={`${formatPlayersCount(match)} igrača`}
                                size="small"
                                color={match.status === 'full' ? 'warning' : match.status === 'failed' ? 'default' : 'primary'}
                              />
                              <Chip 
                                label={match.courtApproval === 'pending' ? 'pending' : match.status}
                                size="small"
                                color={
                                  match.courtApproval === 'pending' ? 'default' :
                                  match.status === 'full' ? 'warning' : 
                                  match.status === 'failed' ? 'error' : 
                                  'success'
                                }
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
                              {match.status !== 'full' && !isUserInMatch(match) && user?.role !== 'court' && (
                                <Button 
                                  variant="contained" 
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJoinMatch(match._id);
                                  }}
                                  fullWidth
                                >
                                  Pridruži se
                                </Button>
                              )}
                              {isUserInMatch(match) && (
                                <Chip label="Pridružen" color="success" size="small" />
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Popup>
                </Marker>
              );
            });
          })()}
        </MapContainer>
      </Paper>
    </Stack>
  );
}


