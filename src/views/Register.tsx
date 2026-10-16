'use client';

import { useEffect, useState } from 'react';
import { Stack, Typography, Button, Alert, Box, Paper, Checkbox } from '@mui/material';
import { useNavigate, Link, useSearchParams } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailIcon from '@mui/icons-material/Email';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import SportsIcon from '@mui/icons-material/Sports';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AuthShell, AuthField, AUTH_CONTROL_HEIGHT } from '../components/auth/AuthParts';
import PreferredGamesPicker from '../components/PreferredGamesPicker';
import { markOnboardingTourPending } from '../lib/onboardingTour';

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
  const { register, loginWithGoogle, loginWithFacebook, completeOAuthRegistration } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralId = searchParams.get('ref') || undefined;
  const stepParam = searchParams.get('step');
  const roleParam = searchParams.get('role');
  const methodParam = searchParams.get('method');
  const requestedStep = isStep(stepParam) ? stepParam : 'method';
  const roleFromUrl = isRole(roleParam) ? roleParam : null;
  const methodFromUrl = isMethod(methodParam) ? methodParam : null;
  const oauthPending = searchParams.get('oauth') === 'pending';

  const [method, setMethod] = useState<Method | null>(() => methodFromUrl ?? readDraft()?.method ?? null);
  const [role, setRole] = useState<Role | null>(() => roleFromUrl ?? readDraft()?.role ?? null);
  const [preferredGames, setPreferredGames] = useState<string[]>(() => readDraft()?.preferredGames ?? []);

  const [name, setName] = useState(() => readDraft()?.name ?? '');
  const [email, setEmail] = useState(() => readDraft()?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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

  // Progress dots cover the steps after the method choice (role → games → account)
  const dotSteps: Step[] = steps.filter((s) => s !== 'method');
  const dotIndex = dotSteps.indexOf(step);

  function buildRegisterUrl(
    next: Step,
    nextMethod = activeMethod,
    nextRole = activeRole,
    keepOAuthPending = oauthPending && (nextMethod === 'google' || nextMethod === 'facebook') && nextMethod === (methodFromUrl ?? method)
  ) {
    const params = new URLSearchParams();
    if (next !== 'method') params.set('step', next);
    if (nextMethod) params.set('method', nextMethod);
    if (nextRole) params.set('role', nextRole);
    if (referralId) params.set('ref', referralId);
    if (keepOAuthPending) params.set('oauth', 'pending');
    const qs = params.toString();
    return qs ? `/register?${qs}` : '/register';
  }

  function goTo(
    next: Step,
    nextMethod = activeMethod,
    nextRole = activeRole,
    keepOAuthPending?: boolean
  ) {
    setError(null);
    navigate(buildRegisterUrl(next, nextMethod, nextRole, keepOAuthPending));
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  function handleBack() {
    if (step === 'method') {
      if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
      else navigate('/');
    } else if (step === 'role') goTo('method');
    else if (step === 'games') goTo('role');
    else if (step === 'account') goTo('games');
  }

  function handleMethodSelect(next: Method) {
    setMethod(next);
    const keepPending = oauthPending && next === (methodFromUrl ?? method);
    goTo('role', next, activeRole, keepPending);
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
    if (oauthPending) {
      try {
        await completeOAuthRegistration(activeRole, preferredGames);
        markOnboardingTourPending();
        clearDraft();
        navigate('/welcome');
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message || 'Registracija nije uspela');
        setLoading(false);
      }
      return;
    }
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

    if (password !== confirmPassword) {
      setError('Lozinke se ne poklapaju');
      return;
    }
    if (!acceptedTerms) {
      setError('Prihvati Uslove korišćenja i Politiku privatnosti da nastaviš');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, activeRole, preferredGames, referralId);
      markOnboardingTourPending();
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
      heading: 'Kreiraj nalog',
      subtitle: 'Popuni osnovne informacije da kreiraš svoj Plejko nalog.',
    },
  };

  const loginFooter = (
    <Typography sx={{ fontSize: 15, color: 'text.secondary', fontWeight: 400 }}>
      Već imaš nalog?{' '}
      <Box
        component={Link}
        to="/login"
        sx={{
          color: 'primary.main',
          fontWeight: 700,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Uloguj se
      </Box>
    </Typography>
  );

  const primaryButtonSx = {
    height: AUTH_CONTROL_HEIGHT,
    borderRadius: '14px',
    fontSize: 16,
    fontWeight: 700,
  };

  const gamesButtonLabel = loading
    ? oauthPending
      ? 'Kreiranje...'
      : 'Preusmeravanje...'
    : oauthPending
      ? 'Završi registraciju'
      : activeMethod === 'email'
        ? 'Nastavi'
        : `Nastavi sa ${activeMethod === 'google' ? 'Google' : 'Facebook'}`;

  return (
    <AuthShell
      title={titles[step].heading}
      subtitle={titles[step].subtitle}
      maxWidth={step === 'games' ? 560 : 440}
      onBack={loading ? undefined : handleBack}
      progress={
        step !== 'method' && dotIndex >= 0
          ? { total: dotSteps.length, current: dotIndex + 1 }
          : undefined
      }
      footer={step === 'account' ? undefined : loginFooter}
    >
      {error && (
        <Alert severity="error" sx={{ mb: '18px', borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      {oauthPending && (step === 'role' || step === 'games') && (
        <Alert severity="info" sx={{ mb: '18px', borderRadius: '12px' }}>
          Ovaj nalog još nije registrovan na Plejku. Izaberi da li si igrač ili teren i koje igre te
          zanimaju.
        </Alert>
      )}

      {referralId && step !== 'method' && (
        <Alert severity="success" sx={{ mb: '18px', borderRadius: '12px' }}>
          Registrovan si preko pozivnice — ti i prijatelj dobijate +2 kredita posle tvog prvog
          odigranog meča.
        </Alert>
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
            disabled={loading || preferredGames.length === 0}
            onClick={() => {
              if (activeMethod === 'email') goTo('account');
              else finishOAuth();
            }}
            sx={primaryButtonSx}
          >
            {gamesButtonLabel}
          </Button>
        </Stack>
      )}

      {step === 'account' && (
        <form onSubmit={onAccountSubmit}>
          <Stack spacing="18px">
            <AuthField
              label="Ime i prezime"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Unesi ime i prezime"
              icon={<PersonOutlineIcon sx={{ fontSize: 22 }} />}
            />
            <AuthField
              label="Email adresa"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Unesi email adresu"
              helperText="Poslaćemo ti link za potvrdu naloga"
              icon={<EmailOutlinedIcon sx={{ fontSize: 22 }} />}
            />
            <AuthField
              label="Lozinka"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Kreiraj lozinku"
              icon={<LockOutlinedIcon sx={{ fontSize: 22 }} />}
              passwordToggle
            />
            <AuthField
              label="Potvrdi lozinku"
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Ponovi lozinku"
              error={confirmPassword.length > 0 && confirmPassword !== password}
              helperText={
                confirmPassword.length > 0 && confirmPassword !== password
                  ? 'Lozinke se ne poklapaju'
                  : undefined
              }
              icon={<LockOutlinedIcon sx={{ fontSize: 22 }} />}
              passwordToggle
            />

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '4px', ml: '-9px' }}>
              <Checkbox
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                inputProps={{ 'aria-label': 'Prihvatam Uslove korišćenja i Politiku privatnosti' }}
                sx={{ p: '9px', mt: '-3px' }}
              />
              <Typography sx={{ fontSize: 14, lineHeight: '21px', color: 'text.primary', fontWeight: 400 }}>
                Prihvatam{' '}
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Uslove korišćenja
                </Box>{' '}
                i{' '}
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Politiku privatnosti
                </Box>
                .
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ ...primaryButtonSx, mt: '10px' }}
            >
              {loading ? 'Kreiranje...' : 'Kreiraj nalog'}
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
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
