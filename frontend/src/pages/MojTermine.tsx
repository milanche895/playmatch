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
  TextField
} from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Match, Field } from '../types';
import { useAuth } from '../context/AuthContext';

type FreeSlot = {
  fieldId: {
    _id: string;
    name: string;
    sport: string;
  };
  dateTime: string;
  available: boolean;
};

type WeeklyStats = {
  completed: number;
  paid: number;
  totalRevenue: number;
};

type CompletedStats = {
  total: number;
  paid: number;
  totalRevenue: number;
};

type AppointmentsData = {
  reserved: Match[];
  free: FreeSlot[];
  weekly?: {
    matches: Match[];
    stats: WeeklyStats;
  };
  completed?: Match[];
  completedStats?: CompletedStats;
  cancelled?: Match[];
  fields: Array<{ _id: string; name: string; sport: string }>;
};

export default function MojTermine() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentsData>({
    reserved: [],
    free: [],
    weekly: {
      matches: [],
      stats: {
        completed: 0,
        paid: 0,
        totalRevenue: 0
      }
    },
    completed: [],
    cancelled: [],
    fields: []
  });
  const [activeTab, setActiveTab] = useState(0);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [reservationDescription, setReservationDescription] = useState('');

  useEffect(() => {
    if (user?.role === 'court') {
      loadAppointments();
    }
  }, [user]);

  async function loadAppointments() {
    try {
      setLoading(true);
      const res = await api.get('/api/courts/appointments');
      // Sort free slots by dateTime
      const sortedFree = [...(res.data.free || [])].sort((a, b) => 
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
      );
      setAppointments({
        reserved: res.data.reserved || [],
        free: sortedFree,
        weekly: res.data.weekly || {
          matches: [],
          stats: {
            completed: 0,
            paid: 0,
            totalRevenue: 0
          }
        },
        completed: res.data.completed || [],
        completedStats: res.data.completedStats || undefined,
        cancelled: res.data.cancelled || [],
        fields: res.data.fields || []
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju termina');
    } finally {
      setLoading(false);
    }
  }

  function handleReserveSlotClick(slot: FreeSlot) {
    setSelectedSlot(slot);
    setReservationDescription('');
    setReserveDialogOpen(true);
  }

  function handleReserveDialogClose() {
    setReserveDialogOpen(false);
    setSelectedSlot(null);
    setReservationDescription('');
  }

  async function handleConfirmReservation() {
    if (!selectedSlot) return;

    try {
      await api.post('/api/courts/appointments/reserve', {
        fieldId: selectedSlot.fieldId._id,
        dateTime: selectedSlot.dateTime,
        description: reservationDescription.trim() || undefined
      });
      
      // Reload appointments to reflect the change
      await loadAppointments();
      
      handleReserveDialogClose();
      alert('Termin je uspešno rezervisan!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Greška pri rezervaciji termina');
    }
  }

  async function handleCompleteMatch(matchId: string) {
    if (!window.confirm('Da li ste sigurni da želite da potvrdite završetak ovog termina?')) {
      return;
    }

    try {
      await api.post(`/api/courts/matches/${matchId}/complete`);
      await loadAppointments();
      alert('Termin je uspešno označen kao završen!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Greška pri potvrdi završetka termina');
    }
  }

  async function handleCancelMatch(matchId: string) {
    if (!window.confirm('Da li ste sigurni da želite da označite ovaj termin kao "Nije održan"?')) {
      return;
    }

    try {
      await api.post(`/api/courts/matches/${matchId}/cancel`);
      await loadAppointments();
      alert('Termin je uspešno označen kao "Nije održan"!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Greška pri označavanju termina');
    }
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

  function formatDate(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('sr-RS', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Stack spacing={{ xs: 2, sm: 3 }}>
      <Typography variant="h4" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Moji Termini
      </Typography>

      <Paper sx={{ overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: { xs: 40, sm: 48 },
            '& .MuiTab-root': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              minHeight: { xs: 40, sm: 48 },
              px: { xs: 1, sm: 2 }
            }
          }}
        >
          <Tab label={`Rezervisani (${appointments.reserved.length})`} />
          <Tab label={`Slobodni (${appointments.free.length})`} />
          <Tab label="Nedeljni" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Stack spacing={2}>
          <Alert severity="info">Rezervisani termini za danas (uključujući završene)</Alert>
          {appointments.reserved.length === 0 ? (
            <Alert severity="info">Nema rezervisanih termina za danas.</Alert>
          ) : (
            appointments.reserved.map((match) => (
              <Card key={match._id} variant="outlined" sx={{ borderRadius: { xs: 2, sm: 3 } }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack spacing={{ xs: 1.5, sm: 2 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ gap: { xs: 0.5, sm: 1 } }}>
                      <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, width: { xs: '100%', sm: 'auto' } }}>
                        {typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren'}
                      </Typography>
                      <Chip
                        label={typeof match.fieldId === 'object' ? match.fieldId.sport : 'Nepoznat sport'}
                        size="small"
                        color="primary"
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                      />
                      <Chip
                        label={match.status === 'full' ? 'Pun' : match.status === 'completed' ? 'Završen' : match.status}
                        size="small"
                        color={match.status === 'full' ? 'warning' : match.status === 'completed' ? 'success' : 'default'}
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                      />
                    </Stack>

                    <Divider />

                    <Stack spacing={0.75}>
                      <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        <strong>Datum i vreme:</strong> {formatDateTime(match.dateTime)}
                      </Typography>
                      <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        <strong>Igrači:</strong> {match.players.length}/{match.playersNeeded}
                      </Typography>
                      {match.players.length > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          <strong>Igrači:</strong>{' '}
                          {match.players.map((p) => p.name).join(', ')}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        <strong>Kreirao:</strong> {match.createdBy.name}
                      </Typography>
                      {match.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          <strong>Opis:</strong> {match.description}
                        </Typography>
                      )}
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ gap: 1 }}>
                      <Chip
                        component={Link}
                        to={`/matches/${match._id}`}
                        label="Vidi detalje"
                        clickable
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 28, sm: 32 }, width: { xs: '100%', sm: 'auto' } }}
                      />
                      {match.status === 'full' && (
                        <>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => handleCompleteMatch(match._id)}
                            sx={{ 
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              py: { xs: 0.5, sm: 0.75 },
                              flex: { xs: 1, sm: 'none' }
                            }}
                          >
                            Potvrdi Završetak
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleCancelMatch(match._id)}
                            sx={{ 
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              py: { xs: 0.5, sm: 0.75 },
                              flex: { xs: 1, sm: 'none' }
                            }}
                          >
                            Nije održan
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {activeTab === 1 && (
        <Stack spacing={2}>
          <Alert severity="info">Slobodni termini za danas</Alert>
          {appointments.free.length === 0 ? (
            <Alert severity="info">Nema slobodnih termina za danas.</Alert>
          ) : (
            <Stack spacing={2}>
              {appointments.free.map((slot, index) => (
                <Card key={index} variant="outlined" sx={{ borderRadius: { xs: 2, sm: 3 } }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Stack spacing={{ xs: 1.5, sm: 2 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ gap: { xs: 0.5, sm: 1 } }}>
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, width: { xs: '100%', sm: 'auto' } }}>
                          {slot.fieldId.name}
                        </Typography>
                        <Chip 
                          label={slot.fieldId.sport} 
                          size="small" 
                          color="primary"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                        />
                        <Chip 
                          label="Slobodan" 
                          size="small" 
                          color="success"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                        />
                      </Stack>
                      <Divider />
                      <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        <strong>Vreme:</strong> {formatTime(slot.dateTime)}
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleReserveSlotClick(slot)}
                        fullWidth
                        sx={{ 
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          py: { xs: 1, sm: 1.25 },
                          fontWeight: 600
                        }}
                      >
                        Rezerviši Termin
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {activeTab === 2 && (
        <Stack spacing={3}>
          {/* Statistics */}
          {appointments.weekly && (
            <Paper sx={{ 
              p: { xs: 2, sm: 3 }, 
              bgcolor: 'primary.light', 
              color: 'primary.contrastText',
              borderRadius: { xs: 2, sm: 3 }
            }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Nedeljna Statistika
              </Typography>
              <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Završeni Termini
                  </Typography>
                  <Typography variant="h4" fontWeight={600} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
                    {appointments.weekly.stats.completed}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Naplaćeni Termini
                  </Typography>
                  <Typography variant="h4" fontWeight={600} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
                    {appointments.weekly.stats.paid}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Ukupna Suma
                  </Typography>
                  <Typography variant="h4" fontWeight={600} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
                    {appointments.weekly.stats.totalRevenue.toLocaleString('sr-RS')} RSD
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Weekly matches */}
          {appointments.weekly && appointments.weekly.matches.length === 0 ? (
            <Alert severity="info">Nema termina ove nedelje.</Alert>
          ) : (
            <Stack spacing={2}>
              {appointments.weekly?.matches.map((match) => (
                <Card key={match._id} variant="outlined" sx={{ borderRadius: { xs: 2, sm: 3 } }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Stack spacing={{ xs: 1.5, sm: 2 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ gap: { xs: 0.5, sm: 1 } }}>
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, width: { xs: '100%', sm: 'auto' } }}>
                          {typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren'}
                        </Typography>
                        <Chip
                          label={typeof match.fieldId === 'object' ? match.fieldId.sport : 'Nepoznat sport'}
                          size="small"
                          color="primary"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                        />
                        <Chip
                          label={match.status === 'full' ? 'Pun' : match.status === 'completed' ? 'Završen' : match.status === 'open' ? 'Otvoren' : match.status}
                          size="small"
                          color={
                            match.status === 'completed' ? 'success' :
                            match.status === 'full' ? 'warning' :
                            match.status === 'open' ? 'info' :
                            'default'
                          }
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                        />
                        {typeof match.fieldId === 'object' && match.fieldId.price && (
                          <Chip
                            label={`${match.fieldId.price} RSD`}
                            size="small"
                            color="secondary"
                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                          />
                        )}
                      </Stack>

                      <Divider />

                      <Stack spacing={0.75}>
                        <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                          <strong>Datum i vreme:</strong> {formatDateTime(match.dateTime)}
                        </Typography>
                        <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                          <strong>Igrači:</strong> {match.players.length}/{match.playersNeeded}
                        </Typography>
                        {match.players.length > 0 && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            <strong>Igrači:</strong>{' '}
                            {match.players.map((p) => p.name).join(', ')}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          <strong>Kreirao:</strong> {match.createdBy.name}
                        </Typography>
                        {match.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            <strong>Opis:</strong> {match.description}
                          </Typography>
                        )}
                      </Stack>

                      <Box>
                        <Chip
                          component={Link}
                          to={`/matches/${match._id}`}
                          label="Vidi detalje"
                          clickable
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 28, sm: 32 } }}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {/* Reservation Dialog */}
      <Dialog 
        open={reserveDialogOpen} 
        onClose={handleReserveDialogClose} 
        maxWidth="sm" 
        fullWidth
        fullScreen={false}
        PaperProps={{
          sx: {
            m: { xs: 1, sm: 2 },
            borderRadius: { xs: 2, sm: 3 },
            maxWidth: { xs: 'calc(100% - 16px)', sm: '600px' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' }, fontWeight: 600 }}>
          Rezerviši Termin
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            {selectedSlot && (
              <>
                <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <strong>Teren:</strong> {selectedSlot.fieldId.name}
                </Typography>
                <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <strong>Datum i vreme:</strong> {formatDateTime(selectedSlot.dateTime)}
                </Typography>
                <TextField
                  label="Opis rezervacije (opciono)"
                  placeholder="Npr. za koga je rezervisan termin"
                  multiline
                  rows={3}
                  fullWidth
                  value={reservationDescription}
                  onChange={(e) => setReservationDescription(e.target.value)}
                  helperText="Možete uneti opis rezervacije, npr. za koga je termin rezervisan"
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    },
                    '& .MuiFormHelperText-root': {
                      fontSize: { xs: '0.75rem', sm: '0.875rem' }
                    }
                  }}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 }, gap: 1 }}>
          <Button 
            onClick={handleReserveDialogClose}
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Otkaži
          </Button>
          <Button 
            onClick={handleConfirmReservation} 
            variant="contained" 
            color="primary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: 600 }}
          >
            Rezerviši
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

