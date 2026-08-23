'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  Paper,
  InputAdornment,
  IconButton,
  LinearProgress,
} from '@mui/material';
import { useNavigate, Link, useSearchParams } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import SportsIcon from '@mui/icons-material/Sports';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlejkoLogo from '../components/PlejkoLogo';
import PreferredGamesPicker from '../components/PreferredGamesPicker';

type Method = 'email' | 'google' | 'facebook';
type Role = 'player' | 'court';
type Step = 'method' | 'role' | 'games' | 'account';

const STEP_ORDER_EMAIL: Step[] = ['method', 'role', 'games', 'account'];
const STEP_ORDER_OAUTH: Step[] = ['method', 'role', 'games'];
const DRAFT_KEY = 'plejko:register-draft';

function isStep(value: string | null): value is Step {
  return value === 'method' || value === 'role' || value === 'games' || value === 'account';
}

function isMethod(value: unknown): value is Method {
  return value === 'email' || value === 'google' || value === 'facebook';
}

function isRole(value: unknown): value is Role {
  return value === 'player' || value === 'court';
}

function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as {
      method?: unknown;
      role?: unknown;
      preferredGames?: unknown;
      name?: unknown;
      email?: unknown;
    };
    return {
      method: isMethod(draft.method) ? draft.method : null,
      role: isRole(draft.role) ? draft.role : null,
      preferredGames: Array.isArray(draft.preferredGames)
        ? draft.preferredGames.filter((id): id is string => typeof id === 'string')
        : [],
      name: typeof draft.name === 'string' ? draft.name : '',
      email: typeof draft.email === 'string' ? draft.email : '',
    };
  } catch {
    return null;
  }
}

export default function Register() {
  const { register, loginWithGoogle, loginWithFacebook } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralId = searchParams.get('ref') || undefined;
  const requestedStep = isStep(searchParams.get('step')) ? searchParams.get('step')! : 'method';
  const roleFromUrl = isRole(searchParams.get('role')) ? searchParams.get('role') : null;
  const methodFromUrl = isMethod(searchParams.get('method')) ? searchParams.get('method') : null;

  const [method, setMethod] = useState<Method | null>(() => methodFromUrl ?? readDraft()?.method ?? null);
  const [role, setRole] = useState<Role | null>(() => roleFromUrl ?? readDraft()?.role ?? null);
  const [preferredGames, setPreferredGames] = useState<string[]>(() => readDraft()?.preferredGames ?? []);

  const [name, setName] = useState(() => readDraft()?.name ?? '');
  const [email, setEmail] = useState(() => readDraft()?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ method, role, preferredGames, name, email })
      );
    } catch {
      // private mode
    }
  }, [method, role, preferredGames, name, email]);

  const activeMethod = methodFromUrl ?? method;
  const activeRole = roleFromUrl ?? role;

  const steps = activeMethod === 'email' ? STEP_ORDER_EMAIL : STEP_ORDER_OAUTH;
  let step: Step = requestedStep;
  if (step === 'account' && activeMethod !== 'email') step = 'games';
  if ((step === 'games' || step === 'account') && !activeRole) step = activeMethod ? 'role' : 'method';
  if (step !== 'method' && !activeMethod) step = 'method';

  const stepIndex = Math.max(0, steps.indexOf(step));
  const progress = ((stepIndex + 1) / steps.length) * 100;

  function buildRegisterUrl(next: Step, nextMethod = activeMethod, nextRole = activeRole) {
    const params = new URLSearchParams();
    if (next !== 'method') params.set('step', next);
    if (nextMethod) params.set('method', nextMethod);
    if (nextRole) params.set('role', nextRole);
    if (referralId) params.set('ref', referralId);
    const qs = params.toString();
    return qs ? `/register?${qs}` : '/register';
  }

  function goTo(next: Step, nextMethod = activeMethod, nextRole = activeRole) {
    setError(null);
    navigate(buildRegisterUrl(next, nextMethod, nextRole));
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  function handleBack() {
    if (step === 'role') goTo('method');
    else if (step === 'games') goTo('role');
    else if (step === 'account') goTo('games');
  }

  function handleMethodSelect(next: Method) {
    setMethod(next);
    goTo('role', next, activeRole);
  }

  function handleRoleSelect(next: Role) {
    setRole(next);
    goTo('games', activeMethod, next);
  }

  async function finishOAuth() {
    if (!activeMethod || activeMethod === 'email' || !activeRole) return;
    if (preferredGames.length === 0) {
      setError(
        activeRole === 'court'
          ? 'Izaberite kategorije i igre koje vaš teren nudi'
          : 'Izaberite barem jednu igru'
      );
      return;
    }
    setLoading(true);
    clearDraft();
    if (activeMethod === 'google') {
      loginWithGoogle(activeRole, preferredGames);
    } else {
      loginWithFacebook(activeRole, preferredGames);
    }
  }

  async function onAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!activeRole) {
      setError('Izaberite da li ste igrač ili teren');
      return;
    }
    if (preferredGames.length === 0) {
      setError(
        activeRole === 'court'
          ? 'Izaberite kategorije i igre koje vaš teren nudi'
          : 'Izaberite barem jednu igru'
      );
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, activeRole, preferredGames, referralId);
      clearDraft();
      await new Promise((resolve) => setTimeout(resolve, 100));
      navigate('/welcome');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      console.error('Registration error:', e);
      setError(err.response?.data?.message || 'Registracija nije uspela');
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Step, { heading: string; subtitle: string }> = {
    method: {
      heading: 'Pridruži se Plejko',
      subtitle: 'Prvo izaberi kako želiš da se registruješ',
    },
    role: {
      heading: 'Ko si ti?',
      subtitle: 'Igrač ili teren',
    },
    games: {
      heading: activeRole === 'court' ? 'Šta nudi tvoj teren?' : 'Šta igraš?',
      subtitle:
        activeRole === 'court'
          ? 'Otvori kategoriju i izaberi igre koje tvoj teren može da organizuje'
          : 'Otvori kategoriju i izaberi igre koje te zanimaju — može više',
    },
    account: {
      heading: 'Napravi nalog',
      subtitle: 'Unesi ime, email i lozinku da završiš registraciju',
    },
  };

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
          maxWidth: 560,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          backgroundImage: `linear-gradient(180deg, rgba(212,0,255,0.06) 0%, transparent 35%)`,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Stack alignItems="center" sx={{ mb: 2 }}>
            <PlejkoLogo size="md" showTagline align="center" />
          </Stack>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            {titles[step].heading}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {titles[step].subtitle}
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3, mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Korak {stepIndex + 1} / {steps.length}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {referralId && step !== 'method' && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            Registrovan si preko pozivnice — ti i prijatelj dobijate +2 kredita posle tvog prvog
            odigranog meča.
          </Alert>
        )}

        {step !== 'method' && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            disabled={loading}
            sx={{ mb: 2, px: 0 }}
          >
            Nazad
          </Button>
        )}

        {step === 'method' && (
          <Stack spacing={1.5}>
            <MethodCard
              icon={<EmailIcon />}
              title="Email i lozinka"
              description="Klasična registracija sa tvojim emailom"
              selected={method === 'email'}
              onClick={() => handleMethodSelect('email')}
            />
            <MethodCard
              icon={<GoogleIcon />}
              title="Google"
              description="Brza registracija preko Gmail naloga"
              selected={method === 'google'}
              onClick={() => handleMethodSelect('google')}
            />
            <MethodCard
              icon={<FacebookIcon />}
              title="Facebook"
              description="Registruj se preko Facebook naloga"
              selected={method === 'facebook'}
              onClick={() => handleMethodSelect('facebook')}
            />
          </Stack>
        )}

        {step === 'role' && (
          <Stack spacing={1.5}>
            <RoleCard
              icon={<SportsIcon sx={{ fontSize: 28 }} />}
              title="Igrač"
              description="Tražim mečeve i mesta za igru"
              selected={activeRole === 'player'}
              onClick={() => handleRoleSelect('player')}
            />
            <RoleCard
              icon={<LocationOnIcon sx={{ fontSize: 28 }} />}
              title="Teren"
              description="Nudim teren ili prostor za sport, kviz, društvene igre ili gaming"
              selected={activeRole === 'court'}
              onClick={() => handleRoleSelect('court')}
            />
          </Stack>
        )}

        {step === 'games' && (
          <Stack spacing={3}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <PreferredGamesPicker
                value={preferredGames}
                onChange={setPreferredGames}
                disabled={loading}
                categoryTitle="Odaberi igre"
                categoryHint={
                  activeRole === 'court'
                    ? 'Otvori kategoriju i izaberi igre koje tvoj teren nudi'
                    : 'Otvori kategoriju i izaberi igre koje te zanimaju'
                }
              />
            </Box>
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || preferredGames.length === 0}
              onClick={() => {
                if (activeMethod === 'email') goTo('account');
                else finishOAuth();
              }}
              sx={{ py: 1.5, fontSize: '1rem' }}
            >
              {loading
                ? 'Preusmeravanje...'
                : activeMethod === 'email'
                  ? 'Nastavi'
                  : `Nastavi sa ${activeMethod === 'google' ? 'Google' : 'Facebook'}`}
            </Button>
          </Stack>
        )}

        {step === 'account' && (
          <form onSubmit={onAccountSubmit}>
            <Stack spacing={3}>
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
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                placeholder="unesite@email.com"
                helperText="Poslaćemo ti link za potvrdu naloga"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
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
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                {loading ? 'Kreiranje...' : 'Kreiraj nalog'}
              </Button>
            </Stack>
          </form>
        )}

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
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Prijavite se
              </Box>
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function MethodCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.main' : 'background.paper',
        color: selected ? 'primary.contrastText' : 'text.primary',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: selected ? 'rgba(255,255,255,0.2)' : 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: selected ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}
          >
            {description}
          </Typography>
        </Box>
        {selected && <CheckCircleIcon sx={{ color: 'white' }} />}
      </Stack>
    </Paper>
  );
}

function RoleCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <MethodCard
      icon={icon}
      title={title}
      description={description}
      selected={selected}
      onClick={onClick}
    />
  );
}
