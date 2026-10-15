'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate, useSearchParams } from '@/lib/router';
import api from '../lib/api';
import { Match } from '../types';
import { useAuth } from '../context/AuthContext';
import { GAME_TYPES, getGameTypeName } from '../constants/games';
import BottomSheet from '../components/BottomSheet';
import SportIcon from '../components/SportIcon';
import StatusPill, { type StatusTone } from '../components/ui/StatusPill';

const SLOT_DURATION_MS = 60 * 60 * 1000; // same as the server's free-slot length
const MONTH_NAMES = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

type FreeSlot = {
  fieldId: { _id: string; name: string; sport?: string; sports?: string[] };
  dateTime: string;
  available: boolean;
};

type Stats = { completed: number; paid: number; totalRevenue: number };

type AppointmentsData = {
  reserved: Match[];
  pending: Match[];
  free: FreeSlot[];
  weekly: { matches: Match[]; stats: Stats };
  monthly: { matches: Match[]; stats: Stats };
  fields: Array<{ _id: string; name: string; sports?: string[] }>;
};

const EMPTY_STATS: Stats = { completed: 0, paid: 0, totalRevenue: 0 };

type TabKey = 'today' | 'week' | 'month';

type Row =
  | { kind: 'match'; key: string; start: Date; fieldId: string; match: Match }
  | { kind: 'free'; key: string; start: Date; fieldId: string; slot: FreeSlot };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const timeLabel = (d: Date) => d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d: Date) => cap(d.toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' }));
const fullDayLabel = (d: Date) =>
  cap(d.toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function fieldOf(match: Match): { _id: string; name: string; sports?: string[]; sport?: string; price?: number } | undefined {
  const f = match.fieldId as unknown;
  return f && typeof f === 'object' ? (f as { _id: string; name: string }) : undefined;
}

function sportsOf(match: Match): string[] {
  const f = fieldOf(match);
  const list = f?.sports?.length ? f.sports : f?.sport ? [f.sport] : match.sport ? [match.sport] : [];
  return list.filter(Boolean);
}

type StatusInfo = {
  label: string;
  tone: StatusTone;
  bar: string;
  bg: string;
  border: string;
  sub?: ReactNode;
};

const PLAIN = { bg: '#FFFFFF', border: '#E3E9F3' };

function statusOf(match: Match): StatusInfo {
  if (match.courtApproval === 'rejected') {
    return { label: 'Odbijen', tone: 'risky', bar: '#E5484D', ...PLAIN };
  }
  if (match.status === 'otkazano' || match.status === 'failed') {
    return { label: 'Nije održan', tone: 'risky', bar: '#E5484D', ...PLAIN };
  }
  if (match.status === 'completed') {
    return { label: 'Završen', tone: 'reliable', bar: '#16A34A', ...PLAIN };
  }
  if (match.courtApproval === 'pending') {
    const ready = match.status === 'full';
    return {
      label: 'Na čekanju',
      tone: 'caution',
      bar: '#0877F9',
      bg: '#F1F6FF',
      border: '#BBD6FB',
      sub: ready ? (
        <Meta icon={<AccessTimeOutlinedIcon sx={{ fontSize: 15 }} />}>Čeka potvrdu</Meta>
      ) : (
        <Meta>Ekipa se popunjava</Meta>
      ),
    };
  }
  if (match.courtApproval === 'approved' && match.status === 'full') {
    return {
      label: 'Rezervisano',
      tone: 'reliable',
      bar: '#16A34A',
      bg: '#F2FAF5',
      border: '#CDEBD6',
      sub: (
        <Meta icon={<CheckIcon sx={{ fontSize: 15, color: '#16A34A' }} />} color="#1B8A4B">
          Potvrđen
        </Meta>
      ),
    };
  }
  return {
    label: 'Otvoreno',
    tone: 'info',
    bar: '#9FB3D1',
    ...PLAIN,
    sub: <Meta>Ekipa se popunjava</Meta>,
  };
}

function Meta({ icon, color = '#5B6B8C', children }: { icon?: ReactNode; color?: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 13, color, whiteSpace: 'nowrap' }}>
      {icon}
      {children}
    </Box>
  );
}

function sportTone(sport: string): { bg: string; color: string } {
  const category = GAME_TYPES[sport]?.category;
  if (sport.startsWith('basketball') || sport === 'nba2k' || category === 'pub') return { bg: '#FFEBD9', color: '#D9531E' };
  if (category === 'tabletop' || category === 'esports') return { bg: '#EFE7FF', color: '#6D3FD1' };
  return { bg: '#E3EEFF', color: '#0877F9' };
}

function SportBadge({ sport }: { sport: string }) {
  const tone = sportTone(sport);
  return (
    <Box
      sx={{
        display: 'inline-block',
        px: '8px',
        py: '2px',
        borderRadius: '7px',
        bgcolor: tone.bg,
        color: tone.color,
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {getGameTypeName(sport)}
    </Box>
  );
}

function RowCard({
  start,
  fieldName,
  sports,
  info,
  playersText,
  onClick,
}: {
  start: Date;
  fieldName: string;
  sports: string[];
  info: StatusInfo;
  playersText: string;
  onClick: () => void;
}) {
  const end = new Date(start.getTime() + SLOT_DURATION_MS);
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        alignItems: 'center',
        gap: '8px',
        p: '12px 8px 12px 12px',
        borderRadius: '14px',
        border: '1px solid',
        borderColor: info.border,
        bgcolor: info.bg,
        fontFamily: 'inherit',
      }}
    >
      <Box sx={{ width: 44, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, color: 'text.primary' }}>{timeLabel(start)}</Typography>
        <Typography sx={{ fontSize: 14, lineHeight: 1.3, color: 'text.secondary' }}>{timeLabel(end)}</Typography>
      </Box>
      <Box sx={{ width: 4, alignSelf: 'stretch', minHeight: 52, borderRadius: '2px', bgcolor: info.bar, flexShrink: 0 }} />
      <Box
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: '10px',
          bgcolor: '#EAF1FD',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sports[0] ? <SportIcon sport={sports[0]} size={26} /> : null}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
          <Typography
            sx={{
              fontSize: 14.5,
              fontWeight: 700,
              lineHeight: 1.25,
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {fieldName}
          </Typography>
          <StatusPill tone={info.tone} size="sm">
            {info.label}
          </StatusPill>
        </Box>
        {sports[0] && (
          <Box sx={{ mt: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {sports.slice(0, 2).map((s) => (
              <SportBadge key={s} sport={s} />
            ))}
          </Box>
        )}
        <Box sx={{ mt: '5px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Meta icon={<PeopleOutlineIcon sx={{ fontSize: 16 }} />}>{playersText}</Meta>
          {info.sub}
        </Box>
      </Box>
      <ChevronRightIcon sx={{ color: '#2B3A5C', fontSize: 22, flexShrink: 0 }} />
    </ButtonBase>
  );
}

function TabPills({
  value,
  onChange,
  items,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  items: { key: TabKey; label: string }[];
}) {
  return (
    <Box role="tablist" sx={{ display: 'flex', p: '4px', gap: '2px', borderRadius: '999px', bgcolor: '#E9F1FD' }}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <ButtonBase
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            sx={{
              flex: 1,
              height: 40,
              borderRadius: '999px',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: active ? '#FFFFFF' : 'primary.main',
              bgcolor: active ? 'primary.main' : 'transparent',
              transition: 'background-color .15s, color .15s',
            }}
          >
            {t.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '16px', py: '8px', borderBottom: '1px solid #EEF2F8' }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 14.5, fontWeight: 600, textAlign: 'right', minWidth: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

const buttonSx = { height: 50, borderRadius: '12px', fontSize: 16, fontWeight: 700 };

export default function MojTermine() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusFieldId = searchParams.get('field');
  const focusMatchId = searchParams.get('match');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentsData>({
    reserved: [],
    pending: [],
    free: [],
    weekly: { matches: [], stats: EMPTY_STATS },
    monthly: { matches: [], stats: EMPTY_STATS },
    fields: [],
  });
  const [tab, setTab] = useState<TabKey>('today');
  const [fieldFilter, setFieldFilter] = useState<string>(focusFieldId || 'all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [reservationDescription, setReservationDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const loadedOnce = useRef(false);
  const handledFocus = useRef(false);

  useEffect(() => {
    if (user?.role === 'court') loadAppointments();
  }, [user, selectedMonth, selectedYear]);

  async function loadAppointments() {
    try {
      if (!loadedOnce.current) setLoading(true);
      const res = await api.get('/api/courts/appointments', { params: { month: selectedMonth, year: selectedYear } });
      const d = res.data;
      setData({
        reserved: d.reserved || [],
        pending: d.pending || [],
        free: [...(d.free || [])].sort(
          (a: FreeSlot, b: FreeSlot) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
        ),
        weekly: { matches: d.weekly?.matches || [], stats: d.weekly?.stats || EMPTY_STATS },
        monthly: { matches: d.monthly?.matches || [], stats: d.monthly?.stats || EMPTY_STATS },
        fields: d.fields || [],
      });
      setError(null);
      loadedOnce.current = true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju termina');
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();

  const matchRow = (m: Match): Row => ({
    kind: 'match',
    key: m._id,
    start: new Date(m.dateTime),
    fieldId: fieldOf(m)?._id ?? '',
    match: m,
  });

  const rowsByTab = useMemo(() => {
    const today = new Date();
    const freeRows: Row[] = data.free.map((slot, i) => ({
      kind: 'free',
      key: `free-${slot.fieldId._id}-${slot.dateTime}-${i}`,
      start: new Date(slot.dateTime),
      fieldId: slot.fieldId._id,
      slot,
    }));

    const todayMatches = data.weekly.matches.filter((m) => sameDay(new Date(m.dateTime), today)).map(matchRow);

    // This week + everything that still needs the owner (waiting for approval, or played but not confirmed yet)
    const weekMap = new Map<string, Match>();
    data.weekly.matches.forEach((m) => weekMap.set(m._id, m));
    data.pending.forEach((m) => weekMap.set(m._id, m));
    data.reserved
      .filter((m) => new Date(m.dateTime).getTime() < Date.now())
      .forEach((m) => weekMap.set(m._id, m));

    const byTime = (a: Row, b: Row) => a.start.getTime() - b.start.getTime();
    return {
      today: [...todayMatches, ...freeRows].sort(byTime),
      week: Array.from(weekMap.values()).map(matchRow).sort(byTime),
      month: data.monthly.matches.map(matchRow).sort(byTime),
    };
  }, [data]);

  const filtered = (rows: Row[]) => (fieldFilter === 'all' ? rows : rows.filter((r) => r.fieldId === fieldFilter));
  const todayRows = filtered(rowsByTab.today);
  const weekRows = filtered(rowsByTab.week);
  const monthRows = filtered(rowsByTab.month);
  const rows = tab === 'today' ? todayRows : tab === 'week' ? weekRows : monthRows;

  const allMatches = useMemo(() => {
    const map = new Map<string, Match>();
    [...data.weekly.matches, ...data.monthly.matches, ...data.pending, ...data.reserved].forEach((m) =>
      map.set(m._id, m),
    );
    return map;
  }, [data]);
  const openMatch = openMatchId ? allMatches.get(openMatchId) ?? null : null;

  // Deep link from a "team ready" notification: ?field=<id>&match=<id>
  useEffect(() => {
    if (handledFocus.current || !focusMatchId || !loadedOnce.current) return;
    const match = allMatches.get(focusMatchId);
    if (!match) return;
    handledFocus.current = true;
    const start = new Date(match.dateTime);
    setTab(sameDay(start, new Date()) ? 'today' : 'week');
    setOpenMatchId(match._id);
  }, [allMatches, focusMatchId, loading]);

  async function runAction(request: () => Promise<unknown>, errorMessage: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      setBusy(true);
      await request();
      setOpenMatchId(null);
      await loadAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || errorMessage);
    } finally {
      setBusy(false);
    }
  }

  const handleApprove = (id: string) =>
    runAction(() => api.post(`/api/courts/matches/${id}/approve`), 'Greška pri potvrdi termina');
  const handleReject = (id: string) =>
    runAction(
      () => api.post(`/api/courts/matches/${id}/reject`),
      'Greška pri odbijanju termina',
      'Odbijanjem se ovaj termin otkazuje. Nastaviti?',
    );
  const handleComplete = (id: string) =>
    runAction(
      () => api.post(`/api/courts/matches/${id}/complete`),
      'Greška pri potvrdi završetka termina',
      'Da li ste sigurni da želite da potvrdite završetak ovog termina?',
    );
  const handleNotHeld = (id: string) =>
    runAction(
      () => api.post(`/api/courts/matches/${id}/cancel`),
      'Greška pri označavanju termina',
      'Da li ste sigurni da želite da označite ovaj termin kao "Nije održan"?',
    );

  async function handleConfirmReservation() {
    if (!selectedSlot) return;
    try {
      setBusy(true);
      await api.post('/api/courts/appointments/reserve', {
        fieldId: selectedSlot.fieldId._id,
        dateTime: selectedSlot.dateTime,
        description: reservationDescription.trim() || undefined,
      });
      setSelectedSlot(null);
      setReservationDescription('');
      await loadAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Greška pri rezervaciji termina');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={8}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekRangeLabel = `${weekStart.getDate()}. ${weekStart.toLocaleDateString('sr-Latn-RS', { month: 'long' })} – ${weekEnd.getDate()}. ${weekEnd.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' })}`;

  const stats = tab === 'week' ? data.weekly.stats : tab === 'month' ? data.monthly.stats : null;

  // Group rows by day for the week / month lists
  const groups: { label: string; rows: Row[] }[] = [];
  if (tab !== 'today') {
    rows.forEach((r) => {
      const label = dayLabel(r.start);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else groups.push({ label, rows: [r] });
    });
  }

  const renderRow = (r: Row) => {
    if (r.kind === 'free') {
      const sports = r.slot.fieldId.sports?.length ? r.slot.fieldId.sports : r.slot.fieldId.sport ? [r.slot.fieldId.sport] : [];
      const min = sports[0] ? GAME_TYPES[sports[0]]?.defaultMinPlayers : undefined;
      return (
        <RowCard
          key={r.key}
          start={r.start}
          fieldName={r.slot.fieldId.name}
          sports={sports}
          info={{ label: 'Slobodno', tone: 'neutral', bar: '#C3CEE0', ...PLAIN }}
          playersText={`0${min ? `/${min}` : ''}`}
          onClick={() => {
            setReservationDescription('');
            setSelectedSlot(r.slot);
          }}
        />
      );
    }
    const m = r.match;
    return (
      <RowCard
        key={r.key}
        start={r.start}
        fieldName={fieldOf(m)?.name ?? 'Nepoznat teren'}
        sports={sportsOf(m)}
        info={statusOf(m)}
        playersText={`${m.players?.length ?? 0}/${m.minPlayers ?? m.playersNeeded}`}
        onClick={() => setOpenMatchId(m._id)}
      />
    );
  };

  const emptyText =
    tab === 'today'
      ? 'Nema termina za danas.'
      : tab === 'week'
        ? 'Nema termina ove nedelje.'
        : 'Nema termina za izabrani mesec.';

  const selectSx = {
    height: 40,
    borderRadius: '10px',
    bgcolor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 600,
    color: 'primary.main',
    '& fieldset': { borderColor: '#E3E9F3' },
    '& .MuiSelect-select': { py: '8px', pr: '30px !important' },
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Typography component="h1" sx={{ fontSize: 32, lineHeight: '38px', fontWeight: 800, letterSpacing: '-0.02em' }}>
        Moji termini
      </Typography>
      <Typography sx={{ mt: '6px', mb: '18px', fontSize: 15, color: 'text.secondary', fontWeight: 400 }}>
        Pregledaj i upravljaj terminima na svojim mestima.
      </Typography>

      <TabPills
        value={tab}
        onChange={setTab}
        items={[
          { key: 'today', label: `Danas (${todayRows.length})` },
          { key: 'week', label: `Nedelja (${weekRows.length})` },
          { key: 'month', label: `Mesec (${monthRows.length})` },
        ]}
      />

      <Box sx={{ mt: '16px', mb: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        {tab === 'month' ? (
          <Box sx={{ display: 'flex', gap: '8px' }}>
            <Select
              size="small"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              sx={selectSx}
              inputProps={{ 'aria-label': 'Mesec' }}
            >
              {MONTH_NAMES.map((name, i) => (
                <MenuItem key={name} value={i + 1}>
                  {name}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              sx={selectSx}
              inputProps={{ 'aria-label': 'Godina' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <CalendarMonthOutlinedIcon sx={{ color: '#4B5B7C', fontSize: 24 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
              {`${(tab === 'today' ? fullDayLabel(now) : weekRangeLabel).replace(/\.$/, '')}.`}
            </Typography>
          </Box>
        )}
        {data.fields.length > 0 && (
          <Select
            size="small"
            value={fieldFilter}
            onChange={(e) => setFieldFilter(String(e.target.value))}
            sx={{ ...selectSx, maxWidth: 160, flexShrink: 0 }}
            inputProps={{ 'aria-label': 'Filter po mestu' }}
          >
            <MenuItem value="all">Sva mesta</MenuItem>
            {data.fields.map((f) => (
              <MenuItem key={f._id} value={f._id}>
                {f.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      {stats && (
        <Box
          sx={{
            display: 'flex',
            mb: '14px',
            borderRadius: '14px',
            border: '1px solid #E3E9F3',
            bgcolor: '#FFFFFF',
            py: '12px',
            '& > div + div': { borderLeft: '1px solid #E3E9F3' },
          }}
        >
          {[
            { label: 'Završeni', value: stats.completed },
            { label: 'Naplaćeni', value: stats.paid },
            { label: 'Prihod', value: `${stats.totalRevenue.toLocaleString('sr-RS')} EUR` },
          ].map((s) => (
            <Box key={s.label} sx={{ flex: 1, textAlign: 'center', px: '6px' }}>
              <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {rows.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '12px' }}>
          {emptyText}
        </Alert>
      ) : tab === 'today' ? (
        <Stack spacing="10px">{rows.map(renderRow)}</Stack>
      ) : (
        <Stack spacing="14px">
          {groups.map((g) => (
            <Box key={g.label}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary', mb: '8px' }}>{g.label}</Typography>
              <Stack spacing="10px">{g.rows.map(renderRow)}</Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Match details + owner actions */}
      <BottomSheet
        open={Boolean(openMatch)}
        onClose={() => !busy && setOpenMatchId(null)}
        title={openMatch ? fieldOf(openMatch)?.name ?? 'Termin' : 'Termin'}
      >
        {openMatch && (
          <MatchSheetBody
            match={openMatch}
            busy={busy}
            onApprove={handleApprove}
            onReject={handleReject}
            onComplete={handleComplete}
            onNotHeld={handleNotHeld}
            onDetails={() => navigate(`/matches/${openMatch._id}`)}
          />
        )}
      </BottomSheet>

      {/* Reserve a free slot */}
      <BottomSheet
        open={Boolean(selectedSlot)}
        onClose={() => !busy && setSelectedSlot(null)}
        title="Rezerviši termin"
      >
        {selectedSlot && (
          <Box>
            <Box sx={{ p: '14px', borderRadius: '14px', bgcolor: '#E3EEFF', mb: '16px' }}>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'text.primary' }}>{selectedSlot.fieldId.name}</Typography>
              <Typography sx={{ fontSize: 14.5, color: 'text.secondary', mt: '2px' }}>
                {new Date(selectedSlot.dateTime).toLocaleString('sr-RS')}
              </Typography>
            </Box>
            <TextField
              label="Opis rezervacije (opciono)"
              placeholder="Npr. za koga je rezervisan termin"
              multiline
              minRows={3}
              fullWidth
              value={reservationDescription}
              onChange={(e) => setReservationDescription(e.target.value)}
              helperText="Možete uneti opis rezervacije"
              sx={{ mb: '18px', '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <Button fullWidth variant="contained" disabled={busy} onClick={handleConfirmReservation} sx={buttonSx}>
              {busy ? 'Rezervisanje...' : 'Rezerviši'}
            </Button>
            <Button
              fullWidth
              variant="soft"
              disabled={busy}
              onClick={() => setSelectedSlot(null)}
              sx={{ ...buttonSx, mt: '10px' }}
            >
              Otkaži
            </Button>
          </Box>
        )}
      </BottomSheet>
    </Box>
  );
}

function MatchSheetBody({
  match,
  busy,
  onApprove,
  onReject,
  onComplete,
  onNotHeld,
  onDetails,
}: {
  match: Match;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onComplete: (id: string) => void;
  onNotHeld: (id: string) => void;
  onDetails: () => void;
}) {
  const info = statusOf(match);
  const start = new Date(match.dateTime);
  const end = new Date(start.getTime() + SLOT_DURATION_MS);
  const field = fieldOf(match);
  const sports = sportsOf(match);
  const canDecide = match.courtApproval === 'pending' && !['otkazano', 'failed', 'completed'].includes(match.status);
  const canFinish = match.courtApproval === 'approved' && match.status === 'full';

  return (
    <Box>
      <Box sx={{ mb: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StatusPill tone={info.tone}>{info.label}</StatusPill>
        {sports.map((s) => (
          <SportBadge key={s} sport={s} />
        ))}
      </Box>
      <InfoLine label="Termin">
        {dayLabel(start)} · {timeLabel(start)} – {timeLabel(end)}
      </InfoLine>
      <InfoLine label="Igrači">
        {match.players?.length ?? 0}/{match.minPlayers ?? match.playersNeeded}
      </InfoLine>
      {match.createdBy?.name && <InfoLine label="Kreirao">{match.createdBy.name}</InfoLine>}
      {field?.price ? <InfoLine label="Cena">{field.price} EUR</InfoLine> : null}
      {(match.players?.length ?? 0) > 0 && (
        <Typography sx={{ mt: '10px', fontSize: 14, color: 'text.secondary' }}>
          Prijavljeni: {match.players.map((p) => p.name).join(', ')}
        </Typography>
      )}
      {match.description && (
        <Box sx={{ mt: '12px', p: '12px', borderRadius: '12px', bgcolor: '#F4F7FC' }}>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', fontStyle: 'italic' }}>{match.description}</Typography>
        </Box>
      )}

      <Stack spacing="10px" sx={{ mt: '20px' }}>
        {canDecide && (
          <>
            <Button fullWidth variant="contained" disabled={busy} onClick={() => onApprove(match._id)} sx={buttonSx}>
              Potvrdi termin
            </Button>
            <Button fullWidth variant="destructive" disabled={busy} onClick={() => onReject(match._id)} sx={buttonSx}>
              Odbij
            </Button>
          </>
        )}
        {canFinish && (
          <>
            <Button fullWidth variant="contained" disabled={busy} onClick={() => onComplete(match._id)} sx={buttonSx}>
              Završen
            </Button>
            <Button fullWidth variant="destructive" disabled={busy} onClick={() => onNotHeld(match._id)} sx={buttonSx}>
              Nije održan
            </Button>
          </>
        )}
        <Button fullWidth variant="soft" disabled={busy} onClick={onDetails} sx={buttonSx}>
          Vidi detalje
        </Button>
      </Stack>
    </Box>
  );
}
