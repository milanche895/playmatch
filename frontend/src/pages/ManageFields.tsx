import { useEffect, useState } from 'react';
import {
  Stack,
  Typography,
  Button,
  Alert,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Collapse,
  IconButton,
  Divider,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Paper,
  Grid,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Field, Match } from '../types';
import { useAuth } from '../context/AuthContext';
import { GAME_TYPE_LIST, getGameTypeName } from '../constants/games';

// Fix Leaflet icon issue
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15);
  }, [map, position]);
  return null;
}

type Appointments = {
  pending: Match[];
  reserved: Match[];
  onRequest: Match[];
  cancelled: Match[];
  free: any[];
};

function formatPlayersCount(match: Match): string {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded;
  const max = match.maxPlayers;
  if (max) {
    return `${current}/${min}-${max}`;
  }
  return `${current}/${min}`;
}

export default function ManageFields() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openWorkingHoursDialog, setOpenWorkingHoursDialog] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [editingWorkingHoursField, setEditingWorkingHoursField] = useState<Field | null>(null);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [appointments, setAppointments] = useState<Record<string, Appointments>>({});
  const [loadingAppointments, setLoadingAppointments] = useState<Record<string, boolean>>({});
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string; closed: boolean }>>({});
  
  const [name, setName] = useState('');
  const [sports, setSports] = useState<string[]>(['football']);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [registrationDeadlineHours, setRegistrationDeadlineHours] = useState<number>(0);

  // Available game types (same list as rest of the app)
  const availableSports = GAME_TYPE_LIST.map((g) => ({ id: g.id, label: g.name }));
  const [mapCenter, setMapCenter] = useState<[number, number]>([44.7866, 20.4489]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (user?.role === 'court') {
      loadFields();
    }
  }, [user]);

  async function loadFields() {
    try {
      setLoading(true);
      const res = await api.get<Field[]>('/api/courts/fields');
      setFields(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno učitavanje terena');
    } finally {
      setLoading(false);
    }
  }

  async function loadAppointments(fieldId: string) {
    try {
      setLoadingAppointments(prev => ({ ...prev, [fieldId]: true }));
      const res = await api.get<Appointments>(`/api/courts/fields/${fieldId}/appointments`);
      setAppointments(prev => ({ ...prev, [fieldId]: res.data }));
    } catch (err: any) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoadingAppointments(prev => ({ ...prev, [fieldId]: false }));
    }
  }

  function toggleFieldExpanded(fieldId: string) {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
        if (!appointments[fieldId]) {
          loadAppointments(fieldId);
        }
      }
      return newSet;
    });
  }

  async function handleApprove(matchId: string, fieldId: string) {
    try {
      await api.post(`/api/courts/matches/${matchId}/approve`);
      await loadAppointments(fieldId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno odobravanje termina');
    }
  }

  async function handleCancel(matchId: string, fieldId: string) {
    try {
      await api.post(`/api/courts/matches/${matchId}/cancel`);
      await loadAppointments(fieldId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno otkazivanje termina');
    }
  }

  async function handleReject(matchId: string, fieldId: string) {
    try {
      await api.post(`/api/courts/matches/${matchId}/reject`);
      await loadAppointments(fieldId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno odbijanje termina');
    }
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function handleMapClick(lat: number, lng: number) {
    setLat(lat.toFixed(6));
    setLng(lng.toFixed(6));
    setMarkerPosition([lat, lng]);
  }

  function getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.latitude && position.coords.longitude) {
            const location: [number, number] = [position.coords.latitude, position.coords.longitude];
            setMapCenter(location);
            setMarkerPosition(location);
            setLat(location[0].toFixed(6));
            setLng(location[1].toFixed(6));
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }

  function openAddDialog() {
    setEditingField(null);
    setName('');
    setSports(['football']);
    setLat('');
    setLng('');
    setPrice(0);
    setRegistrationDeadlineHours(24);
    setMarkerPosition(null);
    setError(null);
    getUserLocation();
    setOpenDialog(true);
  }

  function openEditDialog(field: Field) {
    setEditingField(field);
    setName(field.name);
    // Use sports array if available, otherwise fall back to single sport
    setSports(field.sports || (field.sport ? [field.sport] : ['football']));
    setLat(field.lat.toString());
    setLng(field.lng.toString());
    setPrice(field.price || 0);
    setRegistrationDeadlineHours(field.registrationDeadlineHours ?? 0);
    setMarkerPosition([field.lat, field.lng]);
    setError(null);
    setOpenDialog(true);
  }

  function handleSportToggle(sportId: string) {
    setSports(prev => {
      if (prev.includes(sportId)) {
        return prev.filter(s => s !== sportId);
      } else {
        return [...prev, sportId];
      }
    });
  }

  function handleOpenWorkingHoursDialog(field: Field) {
    setEditingWorkingHoursField(field);
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const defaultHours: Record<string, { start: string; end: string; closed: boolean }> = {};
    days.forEach(day => {
      const existing = field.workingHours?.[day];
      let start = '16';
      let end = '23';
      if (existing && existing.start) {
        start = existing.start.includes(':') ? existing.start.split(':')[0] : existing.start;
      }
      if (existing && existing.end) {
        end = existing.end.includes(':') ? existing.end.split(':')[0] : existing.end;
      }
      defaultHours[day] = { start, end, closed: existing?.closed || false };
    });
    setWorkingHours(defaultHours);
    setError(null);
    setOpenWorkingHoursDialog(true);
  }

  function closeWorkingHoursDialog() {
    setOpenWorkingHoursDialog(false);
    setEditingWorkingHoursField(null);
    setError(null);
  }

  async function handleSaveWorkingHours() {
    if (!editingWorkingHoursField) return;
    try {
      setError(null);
      await api.put(`/api/courts/fields/${editingWorkingHoursField._id}/working-hours`, {
        workingHours
      });
      await loadFields();
      closeWorkingHoursDialog();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno čuvanje radnog vremena');
    }
  }

  function closeDialog() {
    setOpenDialog(false);
    setEditingField(null);
    setError(null);
    setMapCenter([44.7866, 20.4489]);
  }

  async function handleSubmit() {
    if (!name || sports.length === 0 || !lat || !lng) {
      setError('Molimo popunite sva polja, odaberite barem jedan sport i izaberite lokaciju na mapi');
      return;
    }

    try {
      setError(null);
      if (editingField) {
        const deadlineHours = typeof registrationDeadlineHours === 'number' && !isNaN(registrationDeadlineHours) 
          ? registrationDeadlineHours 
          : parseInt(String(registrationDeadlineHours ?? 0));
        
        await api.put(`/api/courts/fields/${editingField._id}`, {
          name,
          sports,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price: typeof price === 'number' ? price : parseFloat(String(price || 0)),
          registrationDeadlineHours: deadlineHours
        });
        await loadFields();
      } else {
        await api.post<Field>('/api/fields', {
          name,
          sports,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price,
          registrationDeadlineHours
        });
        await loadFields();
      }
      closeDialog();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno čuvanje terena');
    }
  }

  if (user?.role !== 'court') {
    return <Alert severity="error" sx={{ borderRadius: 2 }}>Samo tereni mogu pristupiti ovoj stranici</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Nazad
        </Button>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
        >
          <Typography variant="h4" fontWeight={700}>
            Moji Tereni
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
            sx={{ borderRadius: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Dodaj Teren
          </Button>
        </Stack>
      </Box>

      {error && !openDialog && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : fields.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Još nemate terene. Kliknite "Dodaj Teren" da kreirate jedan.
        </Alert>
      ) : (
        <Stack spacing={3}>
          {fields.map((field) => {
            const isExpanded = expandedFields.has(field._id);
            const fieldAppointments = appointments[field._id];
            const isLoading = loadingAppointments[field._id];
            
            return (
              <Card key={field._id} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    {/* Header */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                          }}
                        >
                          <LocationOnIcon sx={{ fontSize: 28 }} />
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>
                            {field.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                            {(field.sports || [field.sport]).filter(Boolean).map((s) => (
                              <Chip key={s} label={getGameTypeName(s!)} size="small" color="primary" />
                            ))}
                            {field.price && field.price > 0 && (
                              <Typography variant="body2" color="text.secondary">
                                {field.price} EUR
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                      
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => openEditDialog(field)}
                          startIcon={<EditIcon />}
                          sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                        >
                          Izmeni
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleOpenWorkingHoursDialog(field)}
                          startIcon={<ScheduleIcon />}
                          sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                        >
                          Radno Vreme
                        </Button>
                        <IconButton
                          onClick={() => toggleFieldExpanded(field._id)}
                          sx={{ ml: { xs: 0, sm: 1 }, alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Stack>
                    </Stack>
                    
                    <Collapse in={isExpanded}>
                      <Divider sx={{ my: 2 }} />
                      {isLoading ? (
                        <Box display="flex" justifyContent="center" py={4}>
                          <CircularProgress />
                        </Box>
                      ) : fieldAppointments ? (
                        <Grid container spacing={2}>
                          {/* Pending */}
                          {fieldAppointments.pending.length > 0 && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                                Na čekanju ({fieldAppointments.pending.length})
                              </Typography>
                              <Stack spacing={2}>
                                {fieldAppointments.pending.map((match) => (
                                  <Paper key={match._id} elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                                      <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                          {formatDateTime(match.dateTime)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          Kreirao: {match.createdBy.name} • Igrači: {formatPlayersCount(match)}
                                        </Typography>
                                      </Box>
                                      <Stack direction="row" spacing={1}>
                                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleApprove(match._id, field._id)}>
                                          Odobri
                                        </Button>
                                        <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => handleReject(match._id, field._id)}>
                                          Odbij
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                ))}
                              </Stack>
                            </Grid>
                          )}
                          
                          {/* Reserved */}
                          {fieldAppointments.reserved.length > 0 && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: 'success.main' }}>
                                Rezervisani ({fieldAppointments.reserved.length})
                              </Typography>
                              <Stack spacing={2}>
                                {fieldAppointments.reserved.map((match) => (
                                  <Paper key={match._id} elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                                      <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                          {formatDateTime(match.dateTime)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          Kreirao: {match.createdBy.name} • Igrači: {formatPlayersCount(match)}
                                        </Typography>
                                      </Box>
                                      <Button size="small" variant="outlined" color="error" onClick={() => handleCancel(match._id, field._id)}>
                                        Otkaži
                                      </Button>
                                    </Stack>
                                  </Paper>
                                ))}
                              </Stack>
                            </Grid>
                          )}
                          
                          {fieldAppointments.pending.length === 0 && fieldAppointments.reserved.length === 0 && (
                            <Grid item xs={12}>
                              <Alert severity="info" sx={{ borderRadius: 2 }}>Nema aktivnih termina za ovaj teren</Alert>
                            </Grid>
                          )}
                        </Grid>
                      ) : null}
                    </Collapse>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4 } }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1.5rem', fontWeight: 700 }}>
          {editingField ? 'Izmeni Teren' : 'Dodaj Novi Teren'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <TextField label="Naziv terena" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />

            {/* Sports Selection with Checkboxes */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Sportovi * (odaberite jedan ili više)
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: sports.length === 0 ? 'error.main' : 'divider',
                  borderRadius: 2,
                  p: 2,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Grid container spacing={1}>
                  {availableSports.map((sport) => (
                    <Grid item xs={6} sm={4} key={sport.id}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sports.includes(sport.id)}
                            onChange={() => handleSportToggle(sport.id)}
                            color="primary"
                          />
                        }
                        label={
                          <Typography variant="body2">{sport.label}</Typography>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
              {sports.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  Molimo odaberite barem jedan sport
                </Typography>
              )}
              {sports.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Odabrani sportovi: {sports.map(s => availableSports.find(as => as.id === s)?.label).join(', ')}
                </Typography>
              )}
            </Box>
            <TextField type="number" label="Cena (EUR)" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} required fullWidth />
            <TextField type="number" label="Rok za prijavu (sati pre meča)" value={registrationDeadlineHours} onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value) && value >= 0 && value <= 168) {
                setRegistrationDeadlineHours(value);
              }
            }} required fullWidth helperText="Koliko sati pre meča se zatvara prijava" />
            
            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2" fontWeight={600}>Lokacija na mapi</Typography>
                <Button size="small" startIcon={<MyLocationIcon />} onClick={getUserLocation}>
                  Moja lokacija
                </Button>
              </Stack>
              <Paper elevation={0} sx={{ height: { xs: 220, sm: 300 }, borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: markerPosition ? 'primary.main' : 'divider' }}>
                <MapContainer center={markerPosition || mapCenter} zoom={markerPosition ? 15 : 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} key={`${mapCenter[0]}-${mapCenter[1]}`}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapCenter position={markerPosition || mapCenter} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
              </Paper>
            </Box>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Geografska širina" value={lat} InputProps={{ readOnly: true }} fullWidth helperText={lat ? '✓ Postavljeno' : 'Kliknite na mapu'} />
              <TextField label="Geografska dužina" value={lng} InputProps={{ readOnly: true }} fullWidth helperText={lng ? '✓ Postavljeno' : 'Kliknite na mapu'} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeDialog} variant="outlined" sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}>Otkaži</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={(!lat || !lng || !name)} sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}>
            {editingField ? 'Ažuriraj Teren' : 'Dodaj Teren'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Working Hours Dialog */}
      <Dialog open={openWorkingHoursDialog} onClose={closeWorkingHoursDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
          Radno Vreme - {editingWorkingHoursField?.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
              const dayNames: Record<string, string> = {
                monday: 'Ponedeljak', tuesday: 'Utorak', wednesday: 'Sreda',
                thursday: 'Četvrtak', friday: 'Petak', saturday: 'Subota', sunday: 'Nedelja'
              };
              const dayData = workingHours[day] || { start: '17', end: '23', closed: false };
              const startHour = dayData.start.includes(':') ? dayData.start.split(':')[0] : dayData.start;
              const endHour = dayData.end.includes(':') ? dayData.end.split(':')[0] : dayData.end;
              
              return (
                <Paper key={day} elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!dayData.closed}
                          onChange={(e) => {
                            setWorkingHours({
                              ...workingHours,
                              [day]: { ...dayData, closed: !e.target.checked }
                            });
                          }}
                        />
                      }
                      label={<Typography variant="body1" fontWeight={600}>{dayNames[day]}</Typography>}
                    />
                    {!dayData.closed && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                        <TextField type="number" label="Od (sat)" value={startHour} onChange={(e) => {
                          const hour = parseInt(e.target.value) || 0;
                          const clampedHour = Math.max(0, Math.min(23, hour));
                          setWorkingHours({ ...workingHours, [day]: { ...dayData, start: clampedHour.toString() }});
                        }} inputProps={{ min: 0, max: 23 }} sx={{ width: { xs: '100%', sm: 100 } }} />
                        <Typography variant="body1" sx={{ display: { xs: 'none', sm: 'block' } }}>-</Typography>
                        <TextField type="number" label="Do (sat)" value={endHour} onChange={(e) => {
                          const hour = parseInt(e.target.value) || 0;
                          const clampedHour = Math.max(0, Math.min(23, hour));
                          setWorkingHours({ ...workingHours, [day]: { ...dayData, end: clampedHour.toString() }});
                        }} inputProps={{ min: 0, max: 23 }} sx={{ width: { xs: '100%', sm: 100 } }} />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeWorkingHoursDialog} variant="outlined" sx={{ borderRadius: 3, px: 3 }}>Otkaži</Button>
          <Button onClick={handleSaveWorkingHours} variant="contained" sx={{ borderRadius: 3, px: 3 }}>Sačuvaj</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
