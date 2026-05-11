import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Tabs,
  Tab,
  Avatar,
} from '@mui/material';
import {
  SportsSoccer as SportsIcon,
  EventAvailable as EventIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  People as PeopleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Match } from '../types';

export default function MojiMecevi() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [createdMatches, setCreatedMatches] = useState<Match[]>([]);
  const [joinedMatches, setJoinedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      setLoading(true);
      const [createdRes, joinedRes] = await Promise.all([
        api.get('/api/players/my-matches/created'),
        api.get('/api/players/my-matches/joined')
      ]);
      setCreatedMatches(createdRes.data);
      setJoinedMatches(joinedRes.data);
    } catch (err: any) {
      console.error('Matches loading error:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatPlayersCount(match: Match): string {
    const current = match.players.length;
    const min = match.minPlayers ?? match.playersNeeded;
    const max = match.maxPlayers;
    if (max) return `${current}/${min}-${max}`;
    return `${current}/${min}`;
  }

  function getMatchStatusColor(match: Match): 'default' | 'primary' | 'success' | 'warning' | 'error' {
    if (match.status === 'full') return 'warning';
    if (match.status === 'completed') return 'success';
    if (match.status === 'open') return 'primary';
    if (match.status === 'otkazano') return 'error';
    return 'default';
  }

  function getMatchStatusLabel(match: Match): string {
    if (match.courtApproval === 'pending') return 'Na čekanju';
    if (match.status === 'full') return 'Pun';
    if (match.status === 'completed') return 'Završen';
    if (match.status === 'open') return 'Otvoren';
    if (match.status === 'otkazano') return 'Otkazan';
    return match.status;
  }

  function getReliabilityColor(score?: number): string {
    const value = score ?? 100;
    if (value >= 80) return 'success.main';
    if (value >= 60) return 'warning.main';
    return 'error.main';
  }

  function canShowConfirmMatchButton(match: Match): boolean {
    const isMatchInProgressState = match.status === 'open' || match.status === 'full';
    const matchStarted = new Date() > new Date(match.dateTime);
    return Boolean(match.isInformal && isMatchInProgressState && matchStarted);
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
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
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap" sx={{ gap: 2 }}>
          <Typography variant="h4" fontWeight={700}>
            <EventIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
            Moji Mečevi
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            to="/create"
            sx={{ borderRadius: 3 }}
          >
            Kreiraj meč
          </Button>
        </Stack>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 56 }}
        >
          <Tab 
            label={`Kreirani (${createdMatches.length})`} 
            sx={{ textTransform: 'none', fontWeight: 600 }}
            icon={<SportsIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab 
            label={`Prijavljeni (${joinedMatches.length})`} 
            sx={{ textTransform: 'none', fontWeight: 600 }}
            icon={<CheckCircleIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Created Matches Tab */}
          {activeTab === 0 && (
            <Stack spacing={2}>
              {createdMatches.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Još niste kreirali nijedan meč.{' '}
                  <Link to="/create" style={{ color: 'inherit', fontWeight: 600 }}>
                    Kreirajte prvi meč!
                  </Link>
                </Alert>
              ) : (
                <>
                  <Alert severity="info" sx={{ borderRadius: 2 }} icon={<PeopleIcon />}>
                    Prikazani su mečevi koje ste kreirali sa listom svih prijavljenih igrača.
                  </Alert>
                  {createdMatches.map((match) => (
                    <Card key={match._id} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                <SportsIcon />
                              </Box>
                              <Box>
                                <Typography variant="h6" fontWeight={700}>
                                  {typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren'}
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                  <Chip label={match.sport} size="small" color="primary" />
                                  <Chip label={getMatchStatusLabel(match)} size="small" color={getMatchStatusColor(match)} />
                                </Stack>
                              </Box>
                            </Stack>
                            <Chip icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} label="Organizator" color="success" size="small" />
                          </Stack>

                          <Divider />

                          <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Datum:</strong> {formatDateTime(match.dateTime)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Igrači:</strong> {formatPlayersCount(match)}
                            </Typography>

                            {/* Players who joined */}
                            {match.players.length > 0 && (
                              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                                  Prijavljeni igrači ({match.players.length}):
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                                  {match.players.map((player) => (
                                    <Chip
                                      key={player._id}
                                      avatar={
                                        <Avatar sx={{ width: 24, height: 24 }}>
                                          {player.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                      }
                                      label={
                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                          <span>{player.name}</span>
                                          <Box
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: '50%',
                                              bgcolor: getReliabilityColor((player as any).reliabilityScore)
                                            }}
                                          />
                                        </Stack>
                                      }
                                      size="small"
                                      variant="outlined"
                                      sx={{ borderRadius: 2 }}
                                    />
                                  ))}
                                </Stack>
                              </Paper>
                            )}

                            {match.players.length === 0 && (
                              <Alert severity="info" sx={{ borderRadius: 2 }}>
                                Još nema prijavljenih igrača na ovaj meč.
                              </Alert>
                            )}
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                              alignSelf: 'stretch',
                              width: '100%',
                            }}
                          >
                            <Button
                              variant="outlined"
                              component={Link}
                              to={`/matches/${match._id}`}
                              fullWidth={!canShowConfirmMatchButton(match)}
                              sx={{
                                borderRadius: 3,
                                flex: canShowConfirmMatchButton(match) ? 1 : undefined,
                              }}
                            >
                              Vidi detalje
                            </Button>
                            {canShowConfirmMatchButton(match) && (
                              <Button
                                variant="contained"
                                color="success"
                                component={Link}
                                to={`/matches/${match._id}?confirmMatch=1`}
                                sx={{ borderRadius: 3, flex: 1 }}
                              >
                                Potvrdi meč
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </Stack>
          )}

          {/* Joined Matches Tab */}
          {activeTab === 1 && (
            <Stack spacing={2}>
              {joinedMatches.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Još niste prijavljeni ni na jedan meč.{' '}
                  <Link to="/" style={{ color: 'inherit', fontWeight: 600 }}>
                    Pronađite mečeve na mapi!
                  </Link>
                </Alert>
              ) : (
                joinedMatches.map((match) => (
                  <Card key={match._id} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                              <CheckCircleIcon />
                            </Box>
                            <Box>
                              <Typography variant="h6" fontWeight={700}>
                                {typeof match.fieldId === 'object' ? match.fieldId.name : 'Nepoznat teren'}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip label={match.sport} size="small" color="primary" />
                                <Chip label={getMatchStatusLabel(match)} size="small" color={getMatchStatusColor(match)} />
                              </Stack>
                            </Box>
                          </Stack>
                        </Stack>

                        <Divider />

                        <Stack spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Datum:</strong> {formatDateTime(match.dateTime)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Igrači:</strong> {formatPlayersCount(match)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Organizator:</strong> {match.createdBy.name}
                          </Typography>
                        </Stack>

                        <Button
                          variant="outlined"
                          component={Link}
                          to={`/matches/${match._id}`}
                          sx={{ borderRadius: 3, alignSelf: 'flex-start' }}
                        >
                          Vidi detalje
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
