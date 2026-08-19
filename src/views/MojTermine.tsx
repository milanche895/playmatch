'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Typography,
  Card,
  CardContent,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Link, useNavigate } from '@/lib/router';
import api from '../lib/api';
import { Match, Field } from '../types';
import { useAuth } from '../context/AuthContext';
import { getGameTypeName } from '../constants/games';

function translateMatchStatus(status: string): string {
  switch (status) {
    case 'open': return 'Otvoren';
    case 'full': return 'Pun';
    case 'completed': return 'Završen';
    case 'failed': return 'Neuspešan';
    case 'otkazano': return 'Otkazan';
    default: return status;
  }
}

type FreeSlot = {
  fieldId: { _id: string; name: string; sport: string; sports?: string[] };
  dateTime: string;
  available: boolean;
};

type WeeklyStats = { completed: number; paid: number; totalRevenue: number };

type MonthlyStats = { completed: number; paid: number; totalRevenue: number; month: number; year: number };

type CompletedStats = { total: number; paid: number; totalRevenue: number };

type AppointmentsData = {
  reserved: Match[];
  pending: Match[];
  free: FreeSlot[];
  weekly?: { matches: Match[]; stats: WeeklyStats };
  monthly?: { matches: Match[]; stats: MonthlyStats; month: number; year: number };
  completed?: Match[];
  completedStats?: CompletedStats;
  cancelled?: Match[];
  fields: Array<{ _id: string; name: string; sport: string }>;
};

function formatPlayersCount(match: Match): string {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded;
  const max = match.maxPlayers;
  if (max) return `${current}/${min}-${max}`;
  return `${current}/${min}`;
}

// Match Card Component
function MatchCard({ match, onComplete, onCancel }: { match: Match; onComplete?: (id: string) => void; onCancel?: (id: string) => void }) {
  const navigate = useNavigate();
  
  return (
    <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'visible' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <LocationOnIcon />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren'}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {typeof match.fieldId === 'object' && match.fieldId.sports ? (
                    match.fieldId.sports.map((s) => (
                      <Chip key={s} label={getGameTypeName(s)} size="small" color="primary" />
                    ))
                  ) : typeof match.fieldId === 'object' && match.fieldId.sport ? (
                    <Chip label={getGameTypeName(match.fieldId.sport)} size="small" color="primary" />
                  ) : match.sport ? (
                    <Chip label={getGameTypeName(match.sport)} size="small" color="primary" />
                  ) : (
                    <Chip label="Nepoznat sport" size="small" color="primary" />
                  )}
                  <Chip
                    label={translateMatchStatus(match.status)}
                    size="small"
                    color={match.status === 'completed' ? 'success' : match.status === 'full' ? 'warning' : match.status === 'open' ? 'info' : match.status === 'failed' || match.status === 'otkazano' ? 'error' : 'default'}
                  />
                </Stack>
              </Box>
            </Stack>
            {typeof match.fieldId === 'object' && match.fieldId.price && (
              <Chip label={`${match.fieldId.price} EUR`} size="small" color="secondary" variant="outlined" />
            )}
          </Stack>

          <Divider />

          {/* Details */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {new Date(match.dateTime).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Igrači: {formatPlayersCount(match)}
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          {match.players.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Prijavljeni: {match.players.map(p => p.name).join(', ')}
              </Typography>
            </Box>
          )}

          {match.description && (
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {match.description}
              </Typography>
            </Paper>
          )}

          {/* Actions */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" size="small" onClick={() => navigate(`/matches/${match._id}`)} sx={{ borderRadius: 3 }}>
              Vidi detalje
            </Button>
            {match.status === 'full' && onComplete && onCancel && (
              <>
                <Button variant="contained" size="small" color="success" onClick={() => onComplete(match._id)} startIcon={<CheckCircleIcon />} sx={{ borderRadius: 3 }}>
                  Završen
                </Button>
                <Button variant="outlined" size="small" color="error" onClick={() => onCancel(match._id)} startIcon={<CancelIcon />} sx={{ borderRadius: 3 }}>
                  Nije održan
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Stats Card Component
function StatsCard({ title, stats, icon: Icon }: { title: string; stats: { completed: number; paid: number; totalRevenue: number }; icon: any }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Icon />
        </Box>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
      </Stack>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} sm={4}>
          <Typography variant="h4" fontWeight={700} color="success.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>{stats.completed}</Typography>
          <Typography variant="body2" color="text.secondary">Završeni</Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>{stats.paid}</Typography>
          <Typography variant="body2" color="text.secondary">Naplaćeni</Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '2.125rem' }, wordBreak: 'break-word' }}>
            {stats.totalRevenue.toLocaleString('sr-RS')}{' '}
            <Typography component="span" variant="body2" color="text.secondary">EUR</Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">Prihod</Typography>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default function MojTermine() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentsData>({
    reserved: [], pending: [], free: [], weekly: { matches: [], stats: { completed: 0, paid: 0, totalRevenue: 0 } },
    completed: [], cancelled: [], fields: [],
  });
  const [activeTab, setActiveTab] = useState(0);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [reservationDescription, setReservationDescription] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => { if (user?.role === 'court') loadAppointments(); }, [user]);
  useEffect(() => { if (user?.role === 'court' && activeTab === 4) loadAppointments(); }, [selectedMonth, selectedYear, activeTab]);

  async function loadAppointments() {
    try {
      setLoading(true);
      const res = await api.get('/api/courts/appointments', { params: { month: selectedMonth, year: selectedYear } });
      const sortedFree = [...(res.data.free || [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      setAppointments({
        reserved: res.data.reserved || [], pending: res.data.pending || [], free: sortedFree,
        weekly: res.data.weekly || { matches: [], stats: { completed: 0, paid: 0, totalRevenue: 0 } },
        monthly: res.data.monthly || { matches: [], stats: { completed: 0, paid: 0, totalRevenue: 0, month: selectedMonth, year: selectedYear }, month: selectedMonth, year: selectedYear },
        completed: res.data.completed || [], completedStats: res.data.completedStats, cancelled: res.data.cancelled || [], fields: res.data.fields || [],
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju termina');
    } finally {
      setLoading(false);
    }
  }

  function handleReserveSlotClick(slot: FreeSlot) { setSelectedSlot(slot); setReservationDescription(''); setReserveDialogOpen(true); }
  function handleReserveDialogClose() { setReserveDialogOpen(false); setSelectedSlot(null); setReservationDescription(''); }

  async function handleConfirmReservation() {
    if (!selectedSlot) return;
    try {
      await api.post('/api/courts/appointments/reserve', { fieldId: selectedSlot.fieldId._id, dateTime: selectedSlot.dateTime, description: reservationDescription.trim() || undefined });
      await loadAppointments();
      handleReserveDialogClose();
    } catch (err: any) { alert(err.response?.data?.message || 'Greška pri rezervaciji termina'); }
  }

  async function handleCompleteMatch(matchId: string) {
    if (!window.confirm('Da li ste sigurni da želite da potvrdite završetak ovog termina?')) return;
    try {
      await api.post(`/api/courts/matches/${matchId}/complete`);
      await loadAppointments();
    } catch (err: any) { alert(err.response?.data?.message || 'Greška pri potvrdi završetka termina'); }
  }

  async function handleCancelMatch(matchId: string) {
    if (!window.confirm('Da li ste sigurni da želite da označite ovaj termin kao "Nije održan"?')) return;
    try {
      await api.post(`/api/courts/matches/${matchId}/cancel`);
      await loadAppointments();
    } catch (err: any) { alert(err.response?.data?.message || 'Greška pri označavanju termina'); }
  }

  if (loading) return <Box display="flex" justifyContent="center" p={8}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2, color: 'text.secondary' }}>Nazad</Button>
        <Typography variant="h4" fontWeight={700}>Moji Termini</Typography>
      </Box>

      {/* Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 56, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 56 } }}>
          <Tab label={`Rezervisano (${appointments.reserved.length})`} />
          <Tab label={`Na čekanju (${appointments.pending.length})`} />
          <Tab label={`Slobodni (${appointments.free.length})`} />
          <Tab label="Nedeljni" />
          <Tab label="Mesečni" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          {appointments.reserved.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Nema rezervisanih termina.</Alert>
          ) : (
            appointments.reserved.map(match => (
              <MatchCard key={match._id} match={match} onComplete={handleCompleteMatch} onCancel={handleCancelMatch} />
            ))
          )}
        </Stack>
      )}

      {activeTab === 1 && (
        <Stack spacing={3}>
          {appointments.pending.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Nema termina na čekanju za danas.</Alert>
          ) : (
            appointments.pending.map(match => <MatchCard key={match._id} match={match} />)
          )}
        </Stack>
      )}

      {activeTab === 2 && (
        <Stack spacing={3}>
          {appointments.free.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Nema slobodnih termina za danas.</Alert>
          ) : (
            appointments.free.map((slot, idx) => (
              <Card key={idx} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <EventIcon />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{slot.fieldId.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(slot.dateTime).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })} • {slot.fieldId.sports?.join(', ') || slot.fieldId.sport || 'Nepoznat sport'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Button variant="contained" onClick={() => handleReserveSlotClick(slot)} sx={{ borderRadius: 3 }}>
                      Rezerviši
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {activeTab === 3 && (
        <Stack spacing={3}>
          {appointments.weekly && <StatsCard title="Nedeljna Statistika" stats={appointments.weekly.stats} icon={EventIcon} />}
          {appointments.weekly?.matches.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Nema termina ove nedelje.</Alert>
          ) : (
            appointments.weekly?.matches.map(match => <MatchCard key={match._id} match={match} />)
          )}
        </Stack>
      )}

      {activeTab === 4 && (
        <Stack spacing={3}>
          {/* Month/Year Selector */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <CalendarMonthIcon color="action" />
              <Typography variant="subtitle1" fontWeight={600}>Izaberi period:</Typography>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} sx={{ borderRadius: 2 }}>
                    {[{ value: 1, label: 'Januar' }, { value: 2, label: 'Februar' }, { value: 3, label: 'Mart' }, { value: 4, label: 'April' }, { value: 5, label: 'Maj' }, { value: 6, label: 'Jun' }, { value: 7, label: 'Jul' }, { value: 8, label: 'Avgust' }, { value: 9, label: 'Septembar' }, { value: 10, label: 'Oktobar' }, { value: 11, label: 'Novembar' }, { value: 12, label: 'Decembar' }].map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} sx={{ borderRadius: 2 }}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {appointments.monthly && <StatsCard title={`${['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'][selectedMonth - 1]} ${selectedYear}`} stats={appointments.monthly.stats} icon={AttachMoneyIcon} />}
          
          {!appointments.monthly || appointments.monthly.matches.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Nema termina za izabrani mesec.</Alert>
          ) : (
            appointments.monthly.matches.map(match => <MatchCard key={match._id} match={match} />)
          )}
        </Stack>
      )}

      {/* Reservation Dialog */}
      <Dialog open={reserveDialogOpen} onClose={handleReserveDialogClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle>
          <Typography variant="h5" fontWeight={700}>Rezerviši Termin</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {selectedSlot && (
              <>
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <Typography variant="h6" fontWeight={700}>{selectedSlot.fieldId.name}</Typography>
                  <Typography variant="body1">{new Date(selectedSlot.dateTime).toLocaleString('sr-RS')}</Typography>
                </Paper>
                <TextField label="Opis rezervacije (opciono)" placeholder="Npr. za koga je rezervisan termin" multiline rows={3} fullWidth value={reservationDescription} onChange={(e) => setReservationDescription(e.target.value)} helperText="Možete uneti opis rezervacije" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleReserveDialogClose} variant="outlined" sx={{ borderRadius: 3 }}>Otkaži</Button>
          <Button onClick={handleConfirmReservation} variant="contained" sx={{ borderRadius: 3 }}>Rezerviši</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
