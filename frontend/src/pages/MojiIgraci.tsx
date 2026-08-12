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
  Avatar,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  People as PeopleIcon,
  SportsSoccer as SportsIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  EmojiEvents as TrophyIcon,
  LocationOn as LocationIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { getTrustBadge } from '../lib/reliability';

interface PlayerMatch {
  _id: string;
  sport: string;
  dateTime: string;
  fieldName: string;
}

interface Player {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  preferredSports?: string[];
  reliabilityScore?: number;
  matchesJoined: number;
  matches: PlayerMatch[];
}

const experienceLabels: Record<string, string> = {
  beginner: 'Početnik',
  intermediate: 'Srednji',
  advanced: 'Napredni',
  professional: 'Profesionalac'
};

const getExperienceColor = (exp?: string) => {
  switch (exp) {
    case 'professional': return 'error';
    case 'advanced': return 'warning';
    case 'intermediate': return 'info';
    default: return 'success';
  }
};

export default function MojiIgraci() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [blockedPlayers, setBlockedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    loadPlayers();
    loadBlockedPlayers();
  }, []);

  async function loadPlayers() {
    try {
      setLoading(true);
      const res = await api.get('/api/players/my-players');
      setPlayers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju igrača');
    } finally {
      setLoading(false);
    }
  }

  async function loadBlockedPlayers() {
    try {
      const res = await api.get('/api/players/blocked-players');
      setBlockedPlayers(res.data.map((p: User) => p._id));
    } catch (err) {
      console.error('Error loading blocked players:', err);
    }
  }

  async function handleBlockPlayer(playerId: string) {
    try {
      setBlockLoading(true);
      await api.post(`/api/players/block-player/${playerId}`);
      setBlockedPlayers(prev => [...prev, playerId]);
      setBlockDialogOpen(false);
      setSelectedPlayer(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri blokiranju igrača');
    } finally {
      setBlockLoading(false);
    }
  }

  async function handleUnblockPlayer(playerId: string) {
    try {
      setBlockLoading(true);
      await api.delete(`/api/players/block-player/${playerId}`);
      setBlockedPlayers(prev => prev.filter(id => id !== playerId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri odblokiranju igrača');
    } finally {
      setBlockLoading(false);
    }
  }

  function openBlockDialog(player: Player) {
    setSelectedPlayer(player);
    setBlockDialogOpen(true);
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
            <PeopleIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
            Moji Igrači
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Ukupno: {players.length} {players.length === 1 ? 'igrač' : players.length > 1 && players.length < 5 ? 'igrača' : 'igrača'}
          </Typography>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {players.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Još nema igrača koji su se prijavili na vaše mečeve.{' '}
          <Link to="/create" style={{ color: 'inherit', fontWeight: 600 }}>
            Kreirajte meč i pozovite igrače!
          </Link>
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {players.map((player) => (
            <Grid item xs={12} md={6} key={player._id}>
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    {/* Player Header */}
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        src={player.avatarUrl}
                        sx={{
                          width: 64,
                          height: 64,
                          border: '2px solid',
                          borderColor: 'primary.main',
                          fontSize: 28,
                          bgcolor: 'primary.light',
                        }}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={700}>
                          {player.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {player.email}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          {(() => {
                            const badge = getTrustBadge(player.reliabilityScore);
                            return (
                              <Chip
                                label={`${badge.emoji} ${badge.label}`}
                                size="small"
                                color={badge.chipColor}
                                variant="outlined"
                                title={`Pouzdanost: ${player.reliabilityScore ?? 100}%`}
                              />
                            );
                          })()}
                          {player.experience && (
                            <Chip
                              label={experienceLabels[player.experience]}
                              size="small"
                              color={getExperienceColor(player.experience) as any}
                            />
                          )}
                          <Chip
                            icon={<TrophyIcon sx={{ fontSize: 16 }} />}
                            label={`${player.matchesJoined} ${player.matchesJoined === 1 ? 'meč' : 'meča'}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                      </Box>
                    </Stack>

                    <Divider />

                    {/* Preferred Sports */}
                    {player.preferredSports && player.preferredSports.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          Omiljeni sportovi:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                          {player.preferredSports.map((sport) => (
                            <Chip key={sport} label={sport} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Matches Accordion */}
                    <Accordion elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'action.hover' }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Prijavljeni na {player.matches.length} {player.matches.length === 1 ? 'meč' : 'meča'}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1}>
                          {player.matches.map((match) => (
                            <Paper
                              key={match._id}
                              elevation={0}
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>
                                    {match.fieldName}
                                  </Typography>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <SportsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      {match.sport}
                                    </Typography>
                                  </Stack>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDateTime(match.dateTime)}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>

                    {/* View Profile Button */}
                    <Button
                      variant="outlined"
                      component={Link}
                      to={`/profil/${player._id}`}
                      sx={{ borderRadius: 3, alignSelf: 'flex-start' }}
                      size="small"
                    >
                      Vidi profil
                    </Button>

                    <Divider />

                    {/* Block Player Toggle */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={blockedPlayers.includes(player._id)}
                          onChange={() => {
                            if (blockedPlayers.includes(player._id)) {
                              handleUnblockPlayer(player._id);
                            } else {
                              openBlockDialog(player);
                            }
                          }}
                          color="error"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <BlockIcon sx={{ fontSize: 16, color: blockedPlayers.includes(player._id) ? 'error.main' : 'text.secondary' }} />
                          <Typography variant="body2" color={blockedPlayers.includes(player._id) ? 'error.main' : 'text.secondary'}>
                            {blockedPlayers.includes(player._id) ? 'Blokiran - ne može videti vaše mečeve' : 'Blokiraj igrača'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Block Confirmation Dialog */}
      <Dialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
          Blokiraj igrača
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Da li ste sigurni da želite da blokirate igrača <strong>{selectedPlayer?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Blokirani igrač neće moći da:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Vidi vaše kreirane mečeve
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Prijavi se na vaše mečeve
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setBlockDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 3 }}
          >
            Otkaži
          </Button>
          <Button
            onClick={() => selectedPlayer && handleBlockPlayer(selectedPlayer._id)}
            variant="contained"
            color="error"
            disabled={blockLoading}
            sx={{ borderRadius: 3 }}
            startIcon={<BlockIcon />}
          >
            {blockLoading ? 'Blokiranje...' : 'Blokiraj'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
