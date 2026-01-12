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
  FormControlLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
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

type Appointments = {
  pending: Match[];
  reserved: Match[];
  onRequest: Match[]; // Termini na upit (open - počelo je brojanje igrača)
  cancelled: Match[];
  free: any[]; // Slobodni termini (može biti prazan array za sada)
};

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

export default function ManageFields() {
  const { user } = useAuth();
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
  
  // Form state
  const [name, setName] = useState('');
  const [sport, setSport] = useState('football');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [registrationDeadlineHours, setRegistrationDeadlineHours] = useState<number>(24);
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
            const location: [number, number] = [
              position.coords.latitude, 
              position.coords.longitude
            ];
            setMapCenter(location);
            setMarkerPosition(location);
            setLat(location[0].toFixed(6));
            setLng(location[1].toFixed(6));
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

  function openAddDialog() {
    setEditingField(null);
    setName('');
    setSport('football');
    setLat('');
    setLng('');
    setPrice(0);
    setRegistrationDeadlineHours(24);
    setMarkerPosition(null);
    setError(null);
    // Get user location first, then open dialog
    getUserLocation();
    setOpenDialog(true);
  }

  function openEditDialog(field: Field) {
    setEditingField(field);
    setName(field.name);
    setSport(field.sport);
    setLat(field.lat.toString());
    setLng(field.lng.toString());
    setPrice(field.price || 0);
    setRegistrationDeadlineHours(field.registrationDeadlineHours ?? 24);
    setMarkerPosition([field.lat, field.lng]);
    setError(null);
    setOpenDialog(true);
  }

  function handleOpenWorkingHoursDialog(field: Field) {
    setEditingWorkingHoursField(field);
    // Initialize working hours from field or use defaults
    // Extract hour from "HH:MM" format or use default
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const defaultHours: Record<string, { start: string; end: string; closed: boolean }> = {};
    days.forEach(day => {
      const existing = field.workingHours?.[day];
      let start = '16';
      let end = '23';
      if (existing && existing.start) {
        // Extract hour from "HH:MM" or use as is if already just hour
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
    setMapCenter([44.7866, 20.4489]); // Reset to default
  }

  async function handleSubmit() {
    if (!name || !sport || !lat || !lng) {
      setError('Molimo popunite sva polja i odaberite lokaciju na mapi');
      return;
    }

    try {
      setError(null);
      if (editingField) {
        // Update existing field (name, sport, location, price, registrationDeadlineHours)
        // Ensure all numeric values are properly converted
        const deadlineHours = typeof registrationDeadlineHours === 'number' && !isNaN(registrationDeadlineHours) 
          ? registrationDeadlineHours 
          : parseInt(String(registrationDeadlineHours ?? 24));
        
        await api.put(`/api/courts/fields/${editingField._id}`, {
          name,
          sport,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price: typeof price === 'number' ? price : parseFloat(String(price || 0)),
          registrationDeadlineHours: deadlineHours
        });
        await loadFields();
      } else {
        // Create new field
        await api.post<Field>('/api/fields', {
          name,
          sport,
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
    return (
      <Alert severity="error">Samo tereni mogu pristupiti ovoj stranici</Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={{ xs: 2, sm: 0 }}
      >
        <Typography 
          variant="h4" 
          fontWeight={600}
          sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
        >
          Moji Tereni
        </Typography>
        <Button 
          variant="contained" 
          onClick={openAddDialog}
          sx={{ 
            fontSize: { xs: '0.875rem', sm: '0.9375rem' },
            py: { xs: 1, sm: 0.75 },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Dodaj Novi Teren
        </Button>
      </Stack>

      {error && !openDialog && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Typography>Učitavanje...</Typography>
      ) : fields.length === 0 ? (
        <Alert severity="info">Još nemate terene. Kliknite "Dodaj Novi Teren" da kreirate jedan.</Alert>
      ) : (
        <Stack spacing={2}>
          {fields.map((field) => {
            const isExpanded = expandedFields.has(field._id);
            const fieldAppointments = appointments[field._id];
            const isLoading = loadingAppointments[field._id];
            
            return (
              <Card key={field._id} sx={{ mb: 2 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Stack spacing={{ xs: 2, sm: 2.5 }}>
                    {/* Header - responsive layout */}
                    <Stack 
                      direction={{ xs: 'column', sm: 'row' }} 
                      justifyContent="space-between" 
                      alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                      spacing={{ xs: 2, sm: 2 }}
                    >
                      {/* Field Info */}
                      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h6" 
                          fontWeight={600}
                          sx={{ 
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                            wordBreak: 'break-word'
                          }}
                        >
                          {field.name}
                        </Typography>
                        
                        {/* Sport and Price - responsive */}
                        <Stack 
                          direction={{ xs: 'column', sm: 'row' }} 
                          spacing={{ xs: 1, sm: 1.5 }} 
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          flexWrap="wrap"
                        >
                          <Chip 
                            label={field.sport} 
                            size="small" 
                            sx={{ 
                              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                              height: { xs: 24, sm: 28 }
                            }} 
                          />
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                              fontWeight: 500
                            }}
                          >
                            Cena: <strong>{field.price || 0} EUR</strong>
                          </Typography>
                        </Stack>
                        
                        {/* Location - hidden on very small screens, shown on larger */}
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                            display: { xs: 'none', sm: 'block' }
                          }}
                        >
                          Lokacija: {field.lat.toFixed(6)}, {field.lng.toFixed(6)}
                        </Typography>
                      </Stack>
                      
                      {/* Action Buttons - responsive */}
                      <Stack 
                        direction={{ xs: 'column', sm: 'row' }} 
                        spacing={{ xs: 1, sm: 1 }}
                        sx={{ 
                          width: { xs: '100%', sm: 'auto' },
                          minWidth: { xs: '100%', sm: 'auto' }
                        }}
                      >
                        <Button 
                          variant="outlined" 
                          onClick={() => openEditDialog(field)}
                          size="small"
                          sx={{ 
                            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                            py: { xs: 0.75, sm: 0.5 },
                            width: { xs: '100%', sm: 'auto' }
                          }}
                        >
                          Izmeni
                        </Button>
                        <Button 
                          variant="outlined" 
                          onClick={() => handleOpenWorkingHoursDialog(field)}
                          size="small"
                          sx={{ 
                            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                            py: { xs: 0.75, sm: 0.5 },
                            width: { xs: '100%', sm: 'auto' }
                          }}
                        >
                          Radno Vreme
                        </Button>
                        <IconButton 
                          onClick={() => toggleFieldExpanded(field._id)}
                          size="small"
                          sx={{ 
                            alignSelf: { xs: 'flex-end', sm: 'center' },
                            ml: { xs: 'auto', sm: 0 }
                          }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Stack>
                    </Stack>
                    
                    <Collapse in={isExpanded}>
                      <Divider sx={{ my: 1 }} />
                      {isLoading ? (
                        <Box display="flex" justifyContent="center" p={2}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : fieldAppointments ? (
                        <Stack spacing={2}>
                          {/* Pending Appointments */}
                          {fieldAppointments.pending.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                                Na čekanju ({fieldAppointments.pending.length})
                              </Typography>
                              <Stack spacing={1}>
                                {fieldAppointments.pending.map((match) => (
                                  <Card key={match._id} variant="outlined" sx={{ mb: 1 }}>
                                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                      <Stack spacing={1.5}>
                                        <Stack spacing={0.5}>
                                          <Typography 
                                            variant="body2" 
                                            sx={{ 
                                              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                              fontWeight: 600
                                            }}
                                          >
                                            {formatDateTime(match.dateTime)}
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Kreirao: <strong>{match.createdBy.name}</strong>
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Igrači: <strong>{formatPlayersCount(match)}</strong>
                                          </Typography>
                                        </Stack>
                                        <Stack 
                                          direction={{ xs: 'column', sm: 'row' }} 
                                          spacing={1} 
                                          sx={{ mt: 1 }}
                                        >
                                          <Button
                                            size="small"
                                            variant="contained"
                                            color="success"
                                            startIcon={<CheckCircleIcon />}
                                            onClick={() => handleApprove(match._id, field._id)}
                                            sx={{ 
                                              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                              py: { xs: 0.75, sm: 0.5 },
                                              width: { xs: '100%', sm: 'auto' }
                                            }}
                                          >
                                            Odobri
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            startIcon={<CancelIcon />}
                                            onClick={() => handleReject(match._id, field._id)}
                                            sx={{ 
                                              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                              py: { xs: 0.75, sm: 0.5 },
                                              width: { xs: '100%', sm: 'auto' }
                                            }}
                                          >
                                            Odbij
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            startIcon={<CancelIcon />}
                                            onClick={() => handleCancel(match._id, field._id)}
                                            sx={{ 
                                              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                              py: { xs: 0.75, sm: 0.5 },
                                              width: { xs: '100%', sm: 'auto' }
                                            }}
                                          >
                                            Otkaži
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Stack>
                            </Box>
                          )}
                          
                          {/* Termini na upit (onRequest) */}
                          {fieldAppointments.onRequest && fieldAppointments.onRequest.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }} color="info.main">
                                Na upit ({fieldAppointments.onRequest.length})
                              </Typography>
                              <Stack spacing={1}>
                                {fieldAppointments.onRequest.map((match) => (
                                  <Card key={match._id} variant="outlined" sx={{ borderColor: 'info.main', mb: 1 }}>
                                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                      <Stack spacing={1.5}>
                                        <Stack spacing={0.5}>
                                          <Typography 
                                            variant="body2" 
                                            sx={{ 
                                              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                              fontWeight: 600
                                            }}
                                          >
                                            {formatDateTime(match.dateTime)}
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Kreirao: <strong>{match.createdBy.name}</strong>
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Igrači: <strong>{formatPlayersCount(match)}</strong>
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="info.main"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' }, fontWeight: 500 }}
                                          >
                                          Status: Traže se igrači
                                        </Typography>
                                      </Stack>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={() => handleCancel(match._id, field._id)}
                                        sx={{ 
                                          fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                          py: { xs: 0.75, sm: 0.5 },
                                          mt: { xs: 0.5, sm: 1 },
                                          width: { xs: '100%', sm: 'auto' }
                                        }}
                                      >
                                        Otkaži
                                      </Button>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Stack>
                            </Box>
                          )}
                          
                          {/* Reserved Appointments */}
                          {fieldAppointments.reserved.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                                Rezervisani ({fieldAppointments.reserved.length})
                              </Typography>
                              <Stack spacing={1}>
                                {fieldAppointments.reserved.map((match) => (
                                  <Card key={match._id} variant="outlined" sx={{ mb: 1 }}>
                                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                      <Stack spacing={1.5}>
                                        <Stack spacing={0.5}>
                                          <Typography 
                                            variant="body2" 
                                            sx={{ 
                                              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                              fontWeight: 600
                                            }}
                                          >
                                            {formatDateTime(match.dateTime)}
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Kreirao: <strong>{match.createdBy.name}</strong>
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Igrači: <strong>{formatPlayersCount(match)}</strong>
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                          >
                                            Status: <strong>{match.status}</strong>
                                          </Typography>
                                        </Stack>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          startIcon={<CancelIcon />}
                                          onClick={() => handleCancel(match._id, field._id)}
                                          sx={{ 
                                            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                                            py: { xs: 0.75, sm: 0.5 },
                                            mt: { xs: 0.5, sm: 1 },
                                            width: { xs: '100%', sm: 'auto' }
                                          }}
                                        >
                                          Otkaži
                                        </Button>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Stack>
                            </Box>
                          )}
                          
                          {/* Cancelled Appointments */}
                          {fieldAppointments.cancelled.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }} color="text.secondary">
                                Otkazani ({fieldAppointments.cancelled.length})
                              </Typography>
                              <Stack spacing={1}>
                                {fieldAppointments.cancelled.map((match) => (
                                  <Card key={match._id} variant="outlined" sx={{ opacity: 0.7, mb: 1 }}>
                                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                      <Stack spacing={1}>
                                        <Typography 
                                          variant="body2" 
                                          color="text.secondary"
                                          sx={{ 
                                            fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                            fontWeight: 500
                                          }}
                                        >
                                          {formatDateTime(match.dateTime)}
                                        </Typography>
                                        <Typography 
                                          variant="body2" 
                                          color="text.secondary"
                                          sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                        >
                                          Kreirao: <strong>{match.createdBy.name}</strong>
                                        </Typography>
                                        <Typography 
                                          variant="body2" 
                                          color="text.secondary"
                                          sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
                                        >
                                          Status: <strong>Otkazano</strong>
                                        </Typography>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Stack>
                            </Box>
                          )}
                          
                          {fieldAppointments.pending.length === 0 && 
                           fieldAppointments.reserved.length === 0 && 
                           (!fieldAppointments.onRequest || fieldAppointments.onRequest.length === 0) &&
                           fieldAppointments.cancelled.length === 0 && (
                            <Alert severity="info">Nema termina za ovaj teren</Alert>
                          )}
                        </Stack>
                      ) : null}
                    </Collapse>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={openDialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingField ? 'Izmeni Teren' : 'Dodaj Novi Teren'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField 
              label="Naziv terena" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              fullWidth 
            />
            <TextField 
              select 
              label="Sport" 
              value={sport} 
              onChange={(e) => setSport(e.target.value)} 
              required 
              fullWidth
            >
              {['football', 'basketball', 'tennis'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Cena (EUR)"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value))}
              required
              fullWidth
            />
            <TextField
              type="number"
              label="Rok za prijavu (sati pre meča)"
              value={registrationDeadlineHours}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 168) {
                  setRegistrationDeadlineHours(value);
                }
              }}
              required
              fullWidth
              inputProps={{ min: 0, max: 168 }}
              helperText="Koliko sati pre meča se zatvara prijava (0 = zatvara se u vreme meča, npr. 24 = 24 sata pre meča)"
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {editingField ? 'Ažuriraj lokaciju na mapi (kliknite da postavite marker)' : 'Odaberite lokaciju na mapi (kliknite da postavite marker)'}
              </Typography>
              <Box sx={{ height: 300, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ccc' }}>
                <MapContainer
                  center={markerPosition || mapCenter}
                  zoom={markerPosition ? 15 : 13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                  key={`${mapCenter[0]}-${mapCenter[1]}`}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenter position={markerPosition || mapCenter} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
              </Box>
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField 
                label="Geografska širina" 
                value={lat} 
                InputProps={{ readOnly: true }}
                fullWidth 
                helperText="Kliknite na mapu da postavite"
              />
              <TextField 
                label="Geografska dužina" 
                value={lng} 
                InputProps={{ readOnly: true }}
                fullWidth
                helperText="Kliknite na mapu da postavite"
              />
            </Stack>
            {!lat && (
              <Alert severity="info">Kliknite bilo gde na mapi da odaberete lokaciju terena</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Otkaži</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={(!lat || !lng || !name)}
          >
            {editingField ? 'Ažuriraj Teren' : 'Dodaj Teren'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Working Hours Dialog */}
      <Dialog open={openWorkingHoursDialog} onClose={closeWorkingHoursDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Radno Vreme - {editingWorkingHoursField?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
              const dayNames: Record<string, string> = {
                monday: 'Ponedeljak',
                tuesday: 'Utorak',
                wednesday: 'Sreda',
                thursday: 'Četvrtak',
                friday: 'Petak',
                saturday: 'Subota',
                sunday: 'Nedelja'
              };
              const dayData = workingHours[day] || { start: '17', end: '23', closed: false };
              // Extract hour if in "HH:MM" format
              const startHour = dayData.start.includes(':') ? dayData.start.split(':')[0] : dayData.start;
              const endHour = dayData.end.includes(':') ? dayData.end.split(':')[0] : dayData.end;
              
              return (
                <Box key={day} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
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
                      <Stack direction="row" spacing={2} alignItems="center">
                        <TextField
                          type="number"
                          label="Od (sat)"
                          value={startHour}
                          onChange={(e) => {
                            const hour = parseInt(e.target.value) || 0;
                            const clampedHour = Math.max(0, Math.min(23, hour));
                            setWorkingHours({
                              ...workingHours,
                              [day]: { ...dayData, start: clampedHour.toString() }
                            });
                          }}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: 0, max: 23, step: 1 }}
                          sx={{ width: 120 }}
                        />
                        <Typography variant="body1">-</Typography>
                        <TextField
                          type="number"
                          label="Do (sat)"
                          value={endHour}
                          onChange={(e) => {
                            const hour = parseInt(e.target.value) || 0;
                            const clampedHour = Math.max(0, Math.min(23, hour));
                            setWorkingHours({
                              ...workingHours,
                              [day]: { ...dayData, end: clampedHour.toString() }
                            });
                          }}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: 0, max: 23, step: 1 }}
                          sx={{ width: 120 }}
                        />
                      </Stack>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeWorkingHoursDialog}>Otkaži</Button>
          <Button onClick={handleSaveWorkingHours} variant="contained">
            Sačuvaj
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

