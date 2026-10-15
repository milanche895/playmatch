'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Stack,
  Typography,
  Button,
  Alert,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate, useSearchParams } from '@/lib/router';
import api from '../lib/api';
import { parseIntegerInput, parseNumberInput, selectNumberField, toNumberOr } from '../lib/numberInput';
import { Field, Match } from '../types';
import { useAuth } from '../context/AuthContext';
import PreferredGamesPicker from '../components/PreferredGamesPicker';
import SportIcon from '../components/SportIcon';
import {
  CATEGORY_META,
  getCategoriesFromGameIds,
  getGameTypeName,
  getVenueNameLabel,
  getVenueNamePlaceholder,
} from '../constants/games';

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

type FieldStats = { today: number; pending: number; reserved: number };

const matchFieldId = (m: Match): string => {
  const f = m.fieldId as unknown;
  if (f && typeof f === 'object') return String((f as { _id: string })._id);
  return f ? String(f) : '';
};

/** Per-field counters for the cards, built from GET /api/courts/appointments. */
function computeFieldStats(data: any): Record<string, FieldStats> {
  const result: Record<string, FieldStats> = {};
  const entry = (id: string) => (result[id] ??= { today: 0, pending: 0, reserved: 0 });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  (data?.weekly?.matches ?? []).forEach((m: Match) => {
    const t = new Date(m.dateTime).getTime();
    const dropped = m.status === 'otkazano' || m.status === 'failed' || m.courtApproval === 'rejected';
    if (!dropped && t >= start.getTime() && t < end.getTime()) entry(matchFieldId(m)).today += 1;
  });
  (data?.free ?? []).forEach((slot: { fieldId: { _id: string } }) => {
    entry(String(slot.fieldId?._id)).today += 1;
  });
  (data?.pending ?? []).forEach((m: Match) => {
    entry(matchFieldId(m)).pending += 1;
  });
  (data?.reserved ?? []).forEach((m: Match) => {
    entry(matchFieldId(m)).reserved += 1;
  });
  return result;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}

function Pill({ bg, color, icon, children }: { bg: string; color: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        px: '10px',
        py: '3px',
        borderRadius: '999px',
        bgcolor: bg,
        color,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

function StatCell({
  icon,
  value,
  label,
  color = 'text.primary',
  labelColor = 'text.secondary',
}: {
  icon: ReactNode;
  value: number | undefined;
  label: string;
  color?: string;
  labelColor?: string;
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', px: '10px' }}>
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, color }}>{value ?? '–'}</Typography>
        <Typography sx={{ fontSize: 12, lineHeight: 1.2, color: labelColor }}>{label}</Typography>
      </Box>
    </Box>
  );
}

function FieldCard({
  field,
  stats,
  onEdit,
  onView,
}: {
  field: Field;
  stats: FieldStats | undefined;
  onEdit: () => void;
  onView: () => void;
}) {
  const sports = (field.sports?.length ? field.sports : field.sport ? [field.sport] : []).filter(Boolean) as string[];
  const categories = getCategoriesFromGameIds(sports);
  const hasStats = stats !== undefined;
  const today = stats?.today ?? 0;
  const pending = stats?.pending ?? 0;
  const reserved = stats?.reserved ?? 0;

  return (
    <Box sx={{ p: '14px', borderRadius: '16px', border: '1px solid #E3E9F3', bgcolor: '#FFFFFF' }}>
      <Box sx={{ display: 'flex', gap: '14px' }}>
        <Box
          sx={{
            width: 88,
            height: 88,
            flexShrink: 0,
            borderRadius: '12px',
            bgcolor: '#EAF1FD',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {sports[0] ? <SportIcon sport={sports[0]} size={44} /> : null}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1.25,
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {field.name}
          </Typography>
          <Box sx={{ mt: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sports.map((s) => (
              <Pill key={s} bg="#E3EEFF" color="#0877F9" icon={<SportIcon sport={s} size={16} />}>
                {getGameTypeName(s)}
              </Pill>
            ))}
            {categories.map((c) => (
              <Pill key={c} bg="#EEF2F8" color="#5B6B8C">
                {CATEGORY_META[c].label}
              </Pill>
            ))}
            {field.price && field.price > 0 ? (
              <Pill bg="#EEF2F8" color="#5B6B8C">
                {field.price} EUR
              </Pill>
            ) : null}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mt: '14px',
          display: 'flex',
          alignItems: 'center',
          '& > div + div': { borderLeft: '1px solid #E3E9F3' },
        }}
      >
        <StatCell
          icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 24, color: '#4B5B7C' }} />}
          value={hasStats ? today : undefined}
          label={plural(today, 'termin danas', 'termina danas', 'termina danas')}
        />
        <StatCell
          icon={<GroupsOutlinedIcon sx={{ fontSize: 24, color: pending > 0 ? '#F28C28' : '#4B5B7C' }} />}
          value={hasStats ? pending : undefined}
          label={plural(pending, 'zahtev na čekanju', 'zahteva na čekanju', 'zahteva na čekanju')}
          color={pending > 0 ? '#E57A12' : 'text.primary'}
          labelColor={pending > 0 ? '#E57A12' : 'text.secondary'}
        />
        <StatCell
          icon={<CheckIcon sx={{ fontSize: 24, color: reserved > 0 ? '#16A34A' : '#4B5B7C' }} />}
          value={hasStats ? reserved : undefined}
          label={plural(reserved, 'rezervisan', 'rezervisana', 'rezervisanih')}
        />
      </Box>

      <Box sx={{ mt: '14px', display: 'flex', gap: '10px' }}>
        <Button
          onClick={onEdit}
          variant="outlined"
          startIcon={<EditOutlinedIcon />}
          sx={{ flex: 1, height: 46, borderRadius: '12px', fontSize: 15, fontWeight: 600, bgcolor: '#FFFFFF' }}
        >
          Uredi
        </Button>
        <Button
          onClick={onView}
          variant="contained"
          startIcon={<CalendarMonthOutlinedIcon />}
          sx={{ flex: 1, height: 46, borderRadius: '12px', fontSize: 15, fontWeight: 600 }}
        >
          Vidi termine
        </Button>
      </Box>
    </Box>
  );
}

export default function ManageFields() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openWorkingHoursDialog, setOpenWorkingHoursDialog] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [editingWorkingHoursField, setEditingWorkingHoursField] = useState<Field | null>(null);
  const [stats, setStats] = useState<Record<string, FieldStats> | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string; closed: boolean }>>({});
  
  const [name, setName] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [price, setPrice] = useState<number | ''>(0);
  const [registrationDeadlineHours, setRegistrationDeadlineHours] = useState<number | ''>(0);
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
      void loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno učitavanje mesta');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await api.get('/api/courts/appointments');
      setStats(computeFieldStats(res.data));
    } catch (err) {
      console.error('Failed to load field stats:', err);
    }
  }

  // Old deep links (?field=&match=) now live on the "Moji termini" screen
  useEffect(() => {
    if (searchParams.get('field') || searchParams.get('match')) {
      navigate(`/moji-termini?${searchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

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
    setSports(user?.preferredSports?.length ? [...user.preferredSports] : []);
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
    setSports(field.sports || (field.sport ? [field.sport] : []));
    setLat(field.lat.toString());
    setLng(field.lng.toString());
    setPrice(field.price || 0);
    setRegistrationDeadlineHours(field.registrationDeadlineHours ?? 0);
    setMarkerPosition([field.lat, field.lng]);
    setError(null);
    setOpenDialog(true);
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
      const normalizedHours = Object.fromEntries(
        Object.entries(workingHours).map(([day, hours]) => [
          day,
          {
            ...hours,
            start: hours.start === '' ? '0' : hours.start,
            end: hours.end === '' ? '0' : hours.end,
          },
        ])
      );
      await api.put(`/api/courts/fields/${editingWorkingHoursField._id}/working-hours`, {
        workingHours: normalizedHours
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
      setError('Popunite naziv, izaberite barem jednu igru i označite lokaciju na mapi');
      return;
    }

    try {
      setError(null);
      if (editingField) {
        await api.put(`/api/courts/fields/${editingField._id}`, {
          name,
          sports,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price: toNumberOr(price, 0),
          registrationDeadlineHours: toNumberOr(registrationDeadlineHours, 0)
        });
        await loadFields();
      } else {
        await api.post<Field>('/api/fields', {
          name,
          sports,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price: toNumberOr(price, 0),
          registrationDeadlineHours: toNumberOr(registrationDeadlineHours, 0)
        });
        await loadFields();
      }
      closeDialog();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno čuvanje mesta');
    }
  }

  if (user?.role !== 'court') {
    return <Alert severity="error" sx={{ borderRadius: 2 }}>Samo vlasnici prostora mogu pristupiti ovoj stranici</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Typography component="h1" sx={{ fontSize: 32, lineHeight: '38px', fontWeight: 800, letterSpacing: '-0.02em' }}>
        Moja mesta
      </Typography>
      <Typography sx={{ mt: '6px', mb: '18px', fontSize: 15, color: 'text.secondary', fontWeight: 400 }}>
        Upravljaj svojim terenima i terminima.
      </Typography>
      <Button
        fullWidth
        variant="contained"
        startIcon={<AddIcon />}
        onClick={openAddDialog}
        sx={{ height: 50, borderRadius: '14px', fontSize: 16, fontWeight: 700, mb: '16px' }}
      >
        Dodaj novo mesto
      </Button>

      {error && !openDialog && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : fields.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Dodaj prvo mesto
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Teren, lokal, board game klub ili gaming arena — igrači će ovde moći da rezervišu termine.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog} sx={{ borderRadius: 3 }}>
            Dodaj mesto
          </Button>
        </Paper>
      ) : (
        <Stack spacing="14px">
          {fields.map((field) => (
            <FieldCard
              key={field._id}
              field={field}
              stats={stats?.[field._id] ?? (stats ? { today: 0, pending: 0, reserved: 0 } : undefined)}
              onEdit={() => openEditDialog(field)}
              onView={() => navigate(`/moji-termini?field=${field._id}`)}
            />
          ))}
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
          {editingField ? 'Izmeni mesto' : 'Dodaj novo mesto'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <TextField
              label={getVenueNameLabel(sports)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              placeholder={getVenueNamePlaceholder(sports)}
            />

            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: sports.length === 0 ? 'error.main' : 'divider',
                bgcolor: 'background.default',
              }}
            >
              <PreferredGamesPicker
                key={openDialog ? (editingField?._id ?? 'new') : 'closed'}
                value={sports}
                onChange={setSports}
                categoryTitle="Šta nudiš *"
                categoryHint="Otvori kategoriju i izaberi igre koje ovo mesto pokriva"
              />
            </Box>
            <TextField
              type="text"
              label="Cena (EUR)"
              value={price}
              onFocus={selectNumberField}
              onChange={(e) => {
                const value = parseNumberInput(e.target.value);
                if (value === null) return;
                if (value === '' || value >= 0) setPrice(value);
              }}
              required
              fullWidth
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              type="text"
              label="Rok za prijavu (sati pre meča)"
              value={registrationDeadlineHours}
              onFocus={selectNumberField}
              onChange={(e) => {
                const value = parseIntegerInput(e.target.value);
                if (value === null) return;
                if (value === '') { setRegistrationDeadlineHours(''); return; }
                if (value >= 0 && value <= 168) setRegistrationDeadlineHours(value);
              }}
              onBlur={() => {
                if (registrationDeadlineHours === '') setRegistrationDeadlineHours(0);
              }}
              required
              fullWidth
              helperText="Koliko sati pre meča se zatvara prijava"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            
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
          {editingField && (
            <Button onClick={() => handleOpenWorkingHoursDialog(editingField)} variant="outlined" startIcon={<ScheduleIcon />} sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}>Radno vreme</Button>
          )}
          <Button onClick={closeDialog} variant="outlined" sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}>Otkaži</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!lat || !lng || !name || sports.length === 0} sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}>
            {editingField ? 'Ažuriraj mesto' : 'Dodaj mesto'}
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
                        <TextField
                          type="text"
                          label="Od (sat)"
                          value={startHour}
                          onFocus={selectNumberField}
                          onChange={(e) => {
                            const hour = parseIntegerInput(e.target.value);
                            if (hour === null) return;
                            setWorkingHours({
                              ...workingHours,
                              [day]: { ...dayData, start: hour === '' ? '' : Math.max(0, Math.min(23, hour)).toString() }
                            });
                          }}
                          onBlur={() => {
                            if (startHour === '') {
                              setWorkingHours({ ...workingHours, [day]: { ...dayData, start: '0' } });
                            }
                          }}
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          sx={{ width: { xs: '100%', sm: 100 } }}
                        />
                        <Typography variant="body1" sx={{ display: { xs: 'none', sm: 'block' } }}>-</Typography>
                        <TextField
                          type="text"
                          label="Do (sat)"
                          value={endHour}
                          onFocus={selectNumberField}
                          onChange={(e) => {
                            const hour = parseIntegerInput(e.target.value);
                            if (hour === null) return;
                            setWorkingHours({
                              ...workingHours,
                              [day]: { ...dayData, end: hour === '' ? '' : Math.max(0, Math.min(23, hour)).toString() }
                            });
                          }}
                          onBlur={() => {
                            if (endHour === '') {
                              setWorkingHours({ ...workingHours, [day]: { ...dayData, end: '0' } });
                            }
                          }}
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                          sx={{ width: { xs: '100%', sm: 100 } }}
                        />
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
