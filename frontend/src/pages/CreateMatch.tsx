import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Stack, Typography, TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Box, Grid, Chip } from '@mui/material';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Field, Match } from '../types';
import { useAuth } from '../context/AuthContext';

// Fix Leaflet icon issue
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// Component for map click handling
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Component to center map dynamically
function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15);
  }, [map, position]);
  return null;
}

type AvailableTimeSlot = {
  date: string; // YYYY-MM-DD
  time: string; // HH:00
  datetime: string; // Full ISO string
  display: string; // Display text
};

export default function CreateMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const query = useQuery();
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [fieldId, setFieldId] = useState<string>(query.get('fieldId') || '');
  const [sport, setSport] = useState<string>('football');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedDateTime, setSelectedDateTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Helper function to round time to full hour (minutes = 00)
  function roundToFullHour(dateTimeString: string): string {
    if (!dateTimeString) return dateTimeString;
    const d = new Date(dateTimeString);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d.toISOString().slice(0, 16);
  }

  const [playersNeeded, setPlayersNeeded] = useState<number>(10);
  
  // Add Field Dialog State
  const [openAddField, setOpenAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldSport, setNewFieldSport] = useState('football');
  const [newFieldLat, setNewFieldLat] = useState('');
  const [newFieldLng, setNewFieldLng] = useState('');
  const [newFieldPrice, setNewFieldPrice] = useState<number>(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>([44.7866, 20.4489]); // Belgrade default
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadFields() {
    api.get('/api/fields').then((res) => setFields(res.data));
  }

  useEffect(() => {
    loadFields();
  }, []);

  // Load field details and generate available time slots when field is selected
  useEffect(() => {
    if (fieldId) {
      loadFieldDetailsAndSlots();
    } else {
      setSelectedField(null);
      setAvailableTimeSlots([]);
      setSelectedDateTime('');
    }
  }, [fieldId]);

  async function loadFieldDetailsAndSlots() {
    if (!fieldId) return;
    
    try {
      setLoadingSlots(true);
      // Load field details
      const fieldRes = await api.get<Field>(`/api/fields/${fieldId}`);
      const field = fieldRes.data;
      setSelectedField(field);

      // Load existing matches for this field to check for conflicts
      const matchesRes = await api.get<Match[]>('/api/matches');
      const fieldMatches = matchesRes.data.filter(m => 
        m.fieldId._id === fieldId || 
        (typeof m.fieldId === 'object' && m.fieldId._id === fieldId) ||
        (typeof m.fieldId === 'string' && m.fieldId === fieldId)
      );

      // Generate available time slots based on working hours
      const slots = generateAvailableTimeSlots(field, fieldMatches);
      setAvailableTimeSlots(slots);
      
      // Set first available slot as default if any exist
      if (slots.length > 0) {
        const firstSlot = slots[0];
        setSelectedDate(firstSlot.date);
        setSelectedDateTime(firstSlot.datetime);
      } else {
        setSelectedDate('');
        setSelectedDateTime('');
      }
    } catch (err: any) {
      console.error('Failed to load field details:', err);
      setError('Neuspešno učitavanje detalja terena');
    } finally {
      setLoadingSlots(false);
    }
  }

  function generateAvailableTimeSlots(field: Field, existingMatches: Match[]): AvailableTimeSlot[] {
    const slots: AvailableTimeSlot[] = [];
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // Next 30 days

    // Get working hours or use defaults
    const workingHours = field.workingHours || {};
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Create a set of reserved times (existing matches)
    const reservedTimes = new Set<string>();
    existingMatches.forEach(match => {
      if (match.status !== 'otkazano' && match.courtApproval !== 'rejected') {
        const matchDate = new Date(match.dateTime);
        const matchTime = matchDate.toISOString().slice(0, 16);
        reservedTimes.add(matchTime);
      }
    });

    // Generate slots for each day
    for (let d = new Date(now); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = dayNames[d.getDay()];
      const dayHours = workingHours[dayOfWeek];
      
      // Skip if day is closed or no working hours defined
      if (!dayHours || dayHours.closed) continue;
      
      // Parse start and end hours
      const startHour = dayHours.start ? parseInt(dayHours.start.split(':')[0]) : 9;
      const endHour = dayHours.end ? parseInt(dayHours.end.split(':')[0]) : 22;
      
      // Generate slots for each hour
      for (let hour = startHour; hour < endHour; hour++) {
        const slotDate = new Date(d);
        slotDate.setHours(hour, 0, 0, 0);
        
        // Skip if slot is in the past
        if (slotDate <= now) continue;
        
        const datetime = slotDate.toISOString().slice(0, 16);
        
        // Skip if already reserved
        if (reservedTimes.has(datetime)) continue;
        
        // Format display text
        const dateStr = slotDate.toLocaleDateString('sr-RS', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        
        slots.push({
          date: slotDate.toISOString().slice(0, 10),
          time: timeStr,
          datetime,
          display: `${dateStr} ${timeStr}`
        });
      }
    }

    return slots.sort((a, b) => a.datetime.localeCompare(b.datetime));
  }

  function getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.latitude && position.coords.longitude) {
            const location: [number, number] = [
              position.coords.latitude, 
              position.coords.longitude
            ];
            setMapCenter(location);
            setMarkerPosition(location);
            setNewFieldLat(location[0].toFixed(6));
            setNewFieldLng(location[1].toFixed(6));
            console.log('User location obtained:', location);
          } else {
            console.warn('Geolocation returned null coordinates');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Keep default location if geolocation fails
        },
        { 
          enableHighAccuracy: true, 
          timeout: 15000,
          maximumAge: 0 // Don't use cached position
        }
      );
    } else {
      console.warn('Geolocation is not supported');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Check if user is logged in
    if (!user) {
      setError('Morate biti ulogovani da biste kreirali meč');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }
    
    if (!fieldId) {
      setError('Molimo odaberite teren');
      return;
    }
    if (!selectedDateTime) {
      setError('Molimo odaberite termin');
      return;
    }
    
    // Check if cookie exists (for debugging)
    const hasCookie = document.cookie.includes('token');
    if (!hasCookie) {
      console.warn('Warning: No token cookie found. You may need to log in again.');
    }
    
    try {
      // Backend will calculate registrationDeadline automatically
      const res = await api.post<Match>('/api/matches', { 
        sport, 
        fieldId, 
        dateTime: selectedDateTime, 
        playersNeeded 
      });
      navigate(`/matches/${res.data._id}`);
    } catch (err: any) {
      console.error('Error creating match:', err);
      if (err.response?.status === 401) {
        setError('Niste autentifikovani. Molimo ulogujte se ponovo.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.response?.data?.message || 'Neuspešno kreiranje meča');
      }
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setNewFieldLat(lat.toFixed(6));
    setNewFieldLng(lng.toFixed(6));
    setMarkerPosition([lat, lng]);
  }

  function handleDialogClose() {
    setOpenAddField(false);
    setError(null);
    setNewFieldName('');
    setNewFieldLat('');
    setNewFieldLng('');
    setNewFieldPrice(0);
    setMarkerPosition(null);
    setMapCenter([44.7866, 20.4489]); // Reset to default
  }

  function handleOpenAddField() {
    // Get user location first, then open dialog
    getUserLocation();
    setOpenAddField(true);
  }

  async function handleAddField() {
    if (!newFieldName || !newFieldLat || !newFieldLng) {
      setError('Molimo popunite sva polja i odaberite lokaciju na mapi');
      return;
    }
    try {
      const res = await api.post<Field>('/api/fields', {
        name: newFieldName,
        sport: newFieldSport,
        lat: parseFloat(newFieldLat),
        lng: parseFloat(newFieldLng),
        price: newFieldPrice
      });
      setFields([...fields, res.data]);
      setFieldId(res.data._id);
      handleDialogClose();
    } catch (err) {
      setError('Neuspešno dodavanje terena');
    }
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <Stack spacing={2} maxWidth={480}>
          <Typography variant="h5" fontWeight={600}>Kreiraj Meč</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Sport" value={sport} onChange={(e) => setSport(e.target.value)} required>
            {['football', 'basketball', 'tennis'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField 
              select 
              label="Teren" 
              value={fieldId} 
              onChange={(e) => setFieldId(e.target.value)} 
              required 
              fullWidth
              helperText={fields.length === 0 ? 'Nema dostupnih terena. Dodajte jedan prvo.' : ''}
            >
              {fields.map((f) => (
                <MenuItem key={f._id} value={f._id}>{f.name} — {f.sport}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={handleOpenAddField} sx={{ minWidth: 120 }}>
              Dodaj Teren
            </Button>
          </Stack>
          {fieldId && selectedField ? (
            loadingSlots ? (
              <Typography>Učitavanje dostupnih termina...</Typography>
            ) : availableTimeSlots.length > 0 ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Odaberite datum i vreme meča
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Slobodni termini za odabrani datum:
                      </Typography>
                      {selectedDate ? (
                        (() => {
                          const dateSlots = availableTimeSlots.filter(s => s.date === selectedDate);
                          return dateSlots.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {dateSlots.map((slot) => (
                                <Chip
                                  key={slot.datetime}
                                  label={slot.time}
                                  onClick={() => {
                                    setSelectedDateTime(slot.datetime);
                                  }}
                                  color={selectedDateTime === slot.datetime ? 'primary' : 'default'}
                                  variant={selectedDateTime === slot.datetime ? 'filled' : 'outlined'}
                                  sx={{ 
                                    cursor: 'pointer',
                                    minWidth: 80,
                                    fontSize: '0.9rem'
                                  }}
                                />
                              ))}
                            </Box>
                          ) : (
                            <Alert severity="info" sx={{ mt: 1 }}>
                              Nema dostupnih termina za ovaj datum
                            </Alert>
                          );
                        })()
                      ) : (
                        <Alert severity="info">
                          Odaberite datum u kalendaru
                        </Alert>
                      )}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      type="date"
                      label="Odaberite datum"
                      value={selectedDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setSelectedDate(newDate);
                        // Reset selected time when date changes
                        setSelectedDateTime('');
                        // Find first available slot for this date
                        const dateSlots = availableTimeSlots.filter(s => s.date === newDate);
                        if (dateSlots.length > 0) {
                          setSelectedDateTime(dateSlots[0].datetime);
                        }
                      }}
                      required
                      fullWidth
                      inputProps={{
                        min: new Date().toISOString().slice(0, 10)
                      }}
                      helperText={selectedDate ? `Odabran datum: ${new Date(selectedDate).toLocaleDateString('sr-RS')}` : ''}
                    />
                  </Grid>
                </Grid>
                {selectedDateTime && (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Alert severity="success">
                      Odabran termin: {availableTimeSlots.find(s => s.datetime === selectedDateTime)?.display}
                    </Alert>
                    <Alert severity="warning">
                      <Typography variant="body2">
                        <strong>Rok za prijavu:</strong>{' '}
                        {(() => {
                          const matchDate = new Date(selectedDateTime);
                          const deadlineHours = selectedField.registrationDeadlineHours || 24;
                          const deadline = new Date(matchDate);
                          deadline.setHours(deadline.getHours() - deadlineHours);
                          return deadline.toLocaleString('sr-RS', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        })()}
                        {' '}({selectedField.registrationDeadlineHours || 24} sati pre meča)
                      </Typography>
                    </Alert>
                  </Stack>
                )}
              </Box>
            ) : (
              <Alert severity="warning">
                Nema dostupnih termina za ovaj teren u narednih 30 dana. Proverite radno vreme terena.
              </Alert>
            )
          ) : (
            <Alert severity="info">
              Molimo odaberite teren da biste videli dostupne termine
            </Alert>
          )}
          <TextField type="number" label="Potrebno igrača" value={playersNeeded} inputProps={{ min: 1 }} onChange={(e) => setPlayersNeeded(parseInt(e.target.value || '1', 10))} required />
          <Button type="submit" variant="contained">Kreiraj Meč</Button>
        </Stack>
      </form>

      <Dialog open={openAddField} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Dodaj Novi Teren</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Naziv terena" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} required fullWidth />
            <TextField select label="Sport" value={newFieldSport} onChange={(e) => setNewFieldSport(e.target.value)} required fullWidth>
              {['football', 'basketball', 'tennis'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Cena (RSD)"
              value={newFieldPrice}
              onChange={(e) => setNewFieldPrice(parseFloat(e.target.value) || 0)}
              fullWidth
              inputProps={{ min: 0 }}
              helperText="Opciono: Postavite cenu za ovaj teren"
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>Odaberite lokaciju na mapi (kliknite da postavite marker)</Typography>
              <Box sx={{ height: 300, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ccc' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={markerPosition ? 15 : 13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                  key={`${mapCenter[0]}-${mapCenter[1]}`}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenter position={mapCenter} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
              </Box>
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField 
                label="Geografska širina" 
                value={newFieldLat} 
                InputProps={{ readOnly: true }}
                fullWidth 
                helperText="Kliknite na mapu da postavite"
              />
              <TextField 
                label="Geografska dužina" 
                value={newFieldLng} 
                InputProps={{ readOnly: true }}
                fullWidth
                helperText="Kliknite na mapu da postavite"
              />
            </Stack>
            {!newFieldLat && (
              <Alert severity="info">Kliknite bilo gde na mapi da odaberete lokaciju terena</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Otkaži</Button>
          <Button onClick={handleAddField} variant="contained" disabled={!newFieldLat || !newFieldLng}>
            Dodaj Teren
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}


