import { useState } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Box,
  Paper,
  InputAdornment,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleSelectionModal from '../components/RoleSelectionModal';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import SportsIcon from '@mui/icons-material/Sports';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PlejkoLogo from '../components/PlejkoLogo';
import SingleGamePreferencePicker from '../components/SingleGamePreferencePicker';
import { markPromptNotificationsAfterRegister, clearPromptNotificationsAfterRegister } from '../components/PostRegisterNotificationDialog';
import { CategoryId } from '../constants/games';

export default function Register() {
  const { register, loginWithGoogle, loginWithFacebook } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralId = searchParams.get('ref') || undefined;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'player' | 'court'>('player');
  const [preferredCategory, setPreferredCategory] = useState<CategoryId | null>(null);
  const [preferredGameType, setPreferredGameType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'facebook' | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (role === 'player') {
      if (!preferredCategory || !preferredGameType) {
        setError('Izaberite kategoriju i igru kojom se bavite');
        return;
      }
    }

    setLoading(true);
    try {
      const preferredSports =
        role === 'player' && preferredGameType ? [preferredGameType] : [];
      if (role === 'player') {
        markPromptNotificationsAfterRegister();
      }
      await register(name, email, password, role, preferredSports, referralId);
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/', { state: { promptNotifications: role === 'player' } });
    } catch (e: any) {
      clearPromptNotificationsAfterRegister();
      console.error('Registration error:', e);
      setError(e.response?.data?.message || 'Registracija nije uspela');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setPendingProvider('google');
    setRoleModalOpen(true);
  }

  function handleFacebookLogin() {
    setPendingProvider('facebook');
    setRoleModalOpen(true);
  }

  function handleRoleSelected(role: 'player' | 'court') {
    setRoleModalOpen(false);

    if (pendingProvider === 'google') {
      loginWithGoogle(role);
    } else if (pendingProvider === 'facebook') {
      handleFacebookLoginWithRole(role);
    }

    setPendingProvider(null);
  }

  function handleFacebookLoginWithRole(role: 'player' | 'court') {
    loginWithFacebook(role);
  }

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 480,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          backgroundImage: `linear-gradient(180deg, rgba(212,0,255,0.06) 0%, transparent 35%)`,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Stack alignItems="center" sx={{ mb: 2 }}>
            <PlejkoLogo size="md" showTagline align="center" />
          </Stack>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Pridruži se Plejko
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Pronađi · Okupi · Igraj
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2 }}
          >
            {error}
          </Alert>
        )}

        {referralId && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            Registrovan si preko pozivnice — ti i prijatelj dobijate +2 kredita posle tvog prvog odigranog meča.
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <Stack spacing={3}>
            {/* Role Selection - Visual Toggle */}
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1.5 }}>
                Ja sam
              </Typography>
              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={(e, newRole) => newRole && setRole(newRole)}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    py: 2,
                    borderRadius: '12px !important',
                    border: '1.5px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="player">
                  <Stack spacing={0.5} alignItems="center">
                    <SportsIcon />
                    <Typography variant="caption" fontWeight={600}>
                      Igrač
                    </Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="court">
                  <Stack spacing={0.5} alignItems="center">
                    <LocationOnIcon />
                    <Typography variant="caption" fontWeight={600}>
                      Vlasnik terena
                    </Typography>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Name Field */}
            <TextField
              label="Ime"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              placeholder="Vaše ime"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Email Field */}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              placeholder="unesite@email.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Field */}
            <TextField
              label="Lozinka"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 20 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {role === 'player' && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <SingleGamePreferencePicker
                  category={preferredCategory}
                  gameTypeId={preferredGameType}
                  onCategoryChange={setPreferredCategory}
                  onGameTypeChange={setPreferredGameType}
                  required
                  disabled={loading}
                />
              </Box>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={
                loading ||
                (role === 'player' && (!preferredCategory || !preferredGameType))
              }
              sx={{
                py: 1.5,
                fontSize: '1rem',
              }}
            >
              {loading ? 'Kreiranje...' : 'Kreiraj nalog'}
            </Button>
          </Stack>
        </form>

        {/* Divider */}
        <Box sx={{ my: 4, position: 'relative' }}>
          <Divider>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                px: 2,
              }}
            >
              ili nastavite sa
            </Typography>
          </Divider>
        </Box>

        {/* Social Login Buttons */}
        <Stack spacing={2}>
          <Button
            variant="outlined"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={loading}
            startIcon={<GoogleIcon />}
            sx={{
              py: 1.25,
              justifyContent: 'center',
            }}
          >
            Google
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={handleFacebookLogin}
            disabled={loading}
            startIcon={<FacebookIcon />}
            sx={{
              py: 1.25,
              justifyContent: 'center',
            }}
          >
            Facebook
          </Button>
        </Stack>

        {/* Sign in link */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Već imate nalog?{' '}
            <Link
              to="/login"
              style={{
                color: 'inherit',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Box
                component="span"
                sx={{
                  color: 'primary.main',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Prijavite se
              </Box>
            </Link>
          </Typography>
        </Box>
      </Paper>

      {pendingProvider && (
        <RoleSelectionModal
          open={roleModalOpen}
          onClose={() => {
            setRoleModalOpen(false);
            setPendingProvider(null);
          }}
          onSelect={handleRoleSelected}
          provider={pendingProvider}
        />
      )}
    </Box>
  );
}
