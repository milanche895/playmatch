'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useLocation } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import {
  completeOnboardingTour,
  isOnboardingTourPath,
  shouldStartOnboardingTour,
} from '../lib/onboardingTour';

type TourStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  openDrawer?: boolean;
};

const PLAYER_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Dobrodošao u Plejko',
    body: 'Plejko je mesto gde pronalaziš igrače i mečeve u blizini. Kroz kratak vodič objasnićemo svaku funkciju: kako da se prijaviš na meč, kako da napraviš svoj, i gde da pratiš ekipu, obaveštenja i profil.',
  },
  {
    id: 'home',
    title: 'Početna — mečevi u blizini',
    body: 'Ovo je tvoja početna. Ovde vidiš otvorene mečeve oko tebe. Ako dozvoliš lokaciju, lista se sužava na radijus koji si podesio (podrazumevano 10 km). Cilj je da brzo vidiš gde fali igrač i da se prijaviš.',
    target: '[data-tour="tour-home-heading"]',
  },
  {
    id: 'sport-filter',
    title: 'Moje igre / Svi mečevi',
    body: '„Moje igre“ prikazuje samo sportove koje si izabrao pri registraciji, da ne gubiš vreme na mečeve koji te ne zanimaju. „Svi mečevi“ pokazuje sve sportove u blizini — koristi to kad želiš da probaš nešto novo ili da vidiš šta se igra u gradu.',
    target: '[data-tour="tour-sport-filter"]',
  },
  {
    id: 'view-mode',
    title: 'Lista i mapa',
    body: 'Lista je brži pregled: vreme, teren, koliko igrača fali i dugme za prijavu. Mapa prikazuje terene (plavo), zvanične mečeve (cijan) i privatne/informalne mečeve (narandžasto). Klik na marker otvara detalje i opciju da se pridružiš ili da kreiraš meč na tom terenu.',
    target: '[data-tour="tour-view-mode"]',
  },
  {
    id: 'match-card',
    title: 'Kartica meča',
    body: 'Svaka kartica je jedan meč. Vidiš sport, vreme, lokaciju, status (otvoren, pun, na čekanju terena) i koliko ljudi fali. „Prijavi se“ te dodaje u ekipu. Ako je meč pun, „Stani u red“ te stavlja na listu čekanja. „Detalji“ otvara chat, spisak igrača i mapu.',
    target: '[data-tour="tour-match-card"]',
  },
  {
    id: 'fab',
    title: 'Brzo kreiranje meča',
    body: 'Ovaj plus uvek ostaje na ekranu. Koristi ga kad želiš da okupiš ekipu: biraš sport, teren ili privatnu lokaciju, vreme, i koliko igrača treba. Formalni meč ide preko registrovanog terena (često treba odobrenje vlasnika). Informalni meč je brži — privatni teren, park ili sala — bez rezervacije terena.',
    target: '[data-tour="tour-fab-create"]',
  },
  {
    id: 'nav-create',
    title: 'Kreiraj meč',
    body: 'Ista funkcija kao plus, samo iz menija. Tamo biraš da li je meč na zvaničnom terenu ili informalni. Posle kreiranja, igrači u blizini mogu dobiti obaveštenje, a ti ostaješ organizator — ti vodiš ekipu dok se meč ne popuni ili otkaže.',
    target: '[data-tour="tour-nav-create"]',
    openDrawer: true,
  },
  {
    id: 'nav-matches',
    title: 'Moji mečevi',
    body: 'Ovde su mečevi koje si ti napravio i oni na koje si se prijavio. Koristi ovu stranicu da vidiš šta te čeka, da otkažeš dolazak (kasno otkazivanje smanjuje pouzdanost), ili da posle meča oceniš saigrače. Ocene grade tvoj prosek i pomažu drugima da znaju s kim igraju.',
    target: '[data-tour="tour-nav-matches"]',
    openDrawer: true,
  },
  {
    id: 'nav-players',
    title: 'Moji igrači',
    body: 'Lista ljudi koji su igrali na tvojim mečevima. Koristi je da ponovo pozoveš istu ekipu, da otvoriš nečiji profil ili da blokiraš igrača. Blokirani igrač neće moći da se prijavi na tvoje buduće mečeve.',
    target: '[data-tour="tour-nav-players"]',
    openDrawer: true,
  },
  {
    id: 'nav-notifications',
    title: 'Obaveštenja',
    body: 'Ovde uključuješ push poruke i biraš radijus (u km). Kad neko u tom krugu napravi meč za tvoje sportove, dobiješ obaveštenje. Bez ovoga lako promašiš slobodno mesto. Na iPhone-u obaveštenja rade tek kad aplikaciju dodaš na početni ekran.',
    target: '[data-tour="tour-nav-notifications"]',
    openDrawer: true,
  },
  {
    id: 'nav-profile',
    title: 'Moj profil',
    body: 'Profil je tvoja vizitkarta: ime, slika, bio, sportovi i nivo veštine. Ovde vidiš ocene, broj odigranih mečeva i skor pouzdanosti (0–100). Pouzdanost pada ako kasno otkažeš. Tu je i link za poziv prijatelja. Druge vidi javni deo profila pre nego što se prijave na meč.',
    target: '[data-tour="tour-nav-profile"]',
    openDrawer: true,
  },
  {
    id: 'outro',
    title: 'Sada možeš da igraš',
    body: 'Kreni sa početne: prijavi se na meč ili napravi svoj. Ako trebaš ekipu, uključi obaveštenja. Ovaj vodič se više neće prikazati — sačuvan je na ovom uređaju.',
  },
];

const COURT_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Dobrodošao, vlasniče terena',
    body: 'Tvoj nalog je za terene i lokale. Igrači prave mečeve na tvojim mestima, a ti odobravaš termine. Ovaj vodič objašnjava gde se to radi i šta svaka stavka znači.',
  },
  {
    id: 'home',
    title: 'Početna mapa',
    body: 'Na početnoj vidiš mečeve i terene u gradu, isto kao igrači. Koristi je da proveriš šta se trenutno dešava oko tvojih lokacija. Rezervacije i odobrenja vodiš iz svojih menija, ne sa ove liste.',
    target: '[data-tour="tour-home-heading"]',
  },
  {
    id: 'nav-fields',
    title: 'Moja mesta',
    body: 'Ovde dodaješ teren ili lokal: ime, sportove, cenu, radno vreme i tačku na mapi. Kad postoji vlasnik, meč na tom terenu čeka tvoje odobrenje. Bez unetog mesta igrači ne mogu da rezervišu tvoj teren kroz Plejko.',
    target: '[data-tour="tour-nav-fields"]',
    openDrawer: true,
  },
  {
    id: 'nav-slots',
    title: 'Moji termini',
    body: 'Lista zahteva za termine. „Na čekanju“ znači da je igrač napravio meč i čeka da kažeš da ili ne. Odobreni meč je rezervisan u tom satu. Odbijeni se neće održati na tvom terenu. Proveravaj ovu stranicu redovno da igrači ne ostanu bez odgovora do isteka roka.',
    target: '[data-tour="tour-nav-slots"]',
    openDrawer: true,
  },
  {
    id: 'outro',
    title: 'Sledeći korak',
    body: 'Dodaj prvo mesto u „Moja mesta“, pa prati nove zahteve u „Moji termini“. Ovaj vodič se više neće prikazati na ovom uređaju.',
  },
];

type Hole = { top: number; left: number; width: number; height: number };

const PAD = 8;

function findVisibleTarget(selector: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
  return (
    nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    }) || null
  );
}

export default function OnboardingTour() {
  const { user } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);

  const steps = useMemo(
    () => (user?.role === 'court' ? COURT_STEPS : PLAYER_STEPS),
    [user?.role]
  );
  const step = steps[stepIndex];
  const total = steps.length;

  const finish = useCallback(() => {
    if (user?._id) completeOnboardingTour(user._id);
    setActive(false);
    setHole(null);
    setStepIndex(0);
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    if (!shouldStartOnboardingTour(user._id)) return;
    if (!isOnboardingTourPath(location.pathname)) return;
    if (location.pathname !== '/') return;

    const timer = window.setTimeout(() => {
      setActive(true);
      setStepIndex(0);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [user?._id, location.pathname]);

  const measure = useCallback(() => {
    if (!active || !step) return;

    const selector = step.target && !(step.openDrawer && isMobile) ? step.target : undefined;
    if (!selector) {
      setHole(null);
      return;
    }

    const el = findVisibleTarget(selector);
    if (!el) {
      setHole(null);
      return;
    }

    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    const rect = el.getBoundingClientRect();
    setHole({
      top: Math.max(0, rect.top - PAD),
      left: Math.max(0, rect.left - PAD),
      width: Math.min(window.innerWidth - 4, rect.width + PAD * 2),
      height: Math.min(window.innerHeight - 4, rect.height + PAD * 2),
    });
  }, [active, step, isMobile]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      measure();
    };

    const t = window.setTimeout(run, 80);
    const interval = window.setInterval(run, 400);
    window.addEventListener('resize', run);
    window.addEventListener('scroll', run, true);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(interval);
      window.removeEventListener('resize', run);
      window.removeEventListener('scroll', run, true);
    };
  }, [active, measure, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active || !step || !user) return null;

  const progress = ((stepIndex + 1) / total) * 100;
  const isLast = stepIndex === total - 1;
  const cardOnTop = step.id === 'fab';

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    let next = stepIndex + 1;
    while (next < steps.length) {
      const candidate = steps[next];
      const selector =
        candidate.target && !(candidate.openDrawer && isMobile) ? candidate.target : undefined;
      if (!selector || findVisibleTarget(selector)) break;
      next += 1;
    }
    if (next >= steps.length) finish();
    else setStepIndex(next);
  }

  function goBack() {
    if (stepIndex === 0) return;
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const dim = 'rgba(5, 10, 24, 0.72)';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {hole ? (
        <>
          <Box onClick={goNext} sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: hole.top, bgcolor: dim, pointerEvents: 'auto' }} />
          <Box onClick={goNext} sx={{ position: 'absolute', top: hole.top, left: 0, width: hole.left, height: hole.height, bgcolor: dim, pointerEvents: 'auto' }} />
          <Box onClick={goNext} sx={{ position: 'absolute', top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, bgcolor: dim, pointerEvents: 'auto' }} />
          <Box onClick={goNext} sx={{ position: 'absolute', top: hole.top + hole.height, left: 0, right: 0, bottom: 0, bgcolor: dim, pointerEvents: 'auto' }} />
          <Box
            sx={{
              position: 'absolute',
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: 2,
              boxShadow: '0 0 0 3px #00D4FF, 0 0 24px rgba(0, 212, 255, 0.45)',
              pointerEvents: 'auto',
            }}
          />
        </>
      ) : (
        <Box onClick={goNext} sx={{ position: 'absolute', inset: 0, bgcolor: dim, pointerEvents: 'auto' }} />
      )}

      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          pointerEvents: 'auto',
          zIndex: 2002,
          p: { xs: 2.25, sm: 3 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          maxHeight: { xs: '48vh', sm: '70vh' },
          overflow: 'auto',
          left: { xs: 12, sm: '50%' },
          right: { xs: 12, sm: 'auto' },
          width: { xs: 'auto', sm: 460 },
          ...(cardOnTop
            ? { top: { xs: 72, sm: 88 }, bottom: 'auto', transform: { xs: 'none', sm: 'translateX(-50%)' } }
            : { bottom: 12, top: 'auto', transform: { xs: 'none', sm: 'translateX(-50%)' } }),
        }}
      >
        <Typography variant="caption" color="primary.main" fontWeight={700}>
          Korak {stepIndex + 1} / {total}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mt: 1, mb: 2, height: 6, borderRadius: 99 }}
        />
        <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
          {step.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
          {step.body}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Button onClick={finish} color="inherit" size="small">
            Preskoči
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={goBack} disabled={stepIndex === 0} variant="outlined" size="small">
              Nazad
            </Button>
            <Button onClick={goNext} variant="contained" size="small">
              {isLast ? 'Završi' : 'Dalje'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
