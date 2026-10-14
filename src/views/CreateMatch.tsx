'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from '@/lib/router';
import {
  Stack,
  Typography,
  TextField,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Box,
  Paper,
  LinearProgress,
  CircularProgress,
  ButtonBase,
  Collapse,
  IconButton,
  Menu,
  alpha,
  useMediaQuery,
  useTheme,
  type Theme,
} from "@mui/material";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../lib/api";
import { parseIntegerInput, parseNumberInput, selectNumberField, toNumberOr } from "../lib/numberInput";
import { Field, Match } from "../types";
import { useAuth } from "../context/AuthContext";
import { isEmailVerified } from "../lib/emailVerified";
import EmailVerificationNeeded from "../components/EmailVerificationNeeded";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import SportIcon from "../components/SportIcon";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import {
  CATEGORY_META,
  GAME_TYPES,
  fieldOffersAnyPreferred,
  getFieldSports,
  getGameType,
  getGameTypeName,
  getSportSelectOptions,
  intersectFieldSportsWithPreferred,
  resolveToCanonicalGameId,
} from "../constants/games";

// Fix Leaflet icon issue
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const LAST_MATCH_PRESET_KEY = "playmatch_lastMatchPreset";
const BELGRADE: [number, number] = [44.7866, 20.4489];

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type LastMatchPreset = {
  sport: string;
  isInformal: boolean;
  fieldId?: string;
  fieldName?: string;
  informalLocationName?: string;
  informalLat?: number;
  informalLng?: number;
  minPlayers: number;
  maxPlayers: number | "";
  pricePerPlayer: number | "";
  informalRegistrationDeadlineHours?: number;
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(position, 15); }, [map, position]);
  return null;
}

type AvailableTimeSlot = { date: string; time: string; datetime: string; display: string };

export default function CreateMatch() {
  const { user, refreshUser } = useAuth();
  const [verificationChecked, setVerificationChecked] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;
  const navigate = useNavigate();
  const query = useQuery();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [activeStep, setActiveStep] = useState(0);

  // ── Informal mode ──
  const [isInformal, setIsInformal] = useState(false);
  const [informalLocationName, setInformalLocationName] = useState("");
  const [informalMapCenter, setInformalMapCenter] = useState<[number, number]>(BELGRADE);
  const [informalMarkerPosition, setInformalMarkerPosition] = useState<[number, number] | null>(null);
  const [informalRegistrationDeadlineHours, setInformalRegistrationDeadlineHours] = useState<number>(1);

  // ── User location (always used for create match) ──
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ── Formal mode ──
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [fieldId, setFieldId] = useState<string>(query.get("fieldId") || "");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Shared ──
  const preferredSports = useMemo(
    () =>
      (user?.preferredSports || [])
        .map((id) => resolveToCanonicalGameId(id) || id)
        .filter((id, i, arr) => GAME_TYPES[id] && arr.indexOf(id) === i),
    [user?.preferredSports]
  );
  const sportOptions = useMemo(
    () => getSportSelectOptions(preferredSports),
    [preferredSports]
  );

  const [sport, setSport] = useState<string>("");
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");
  const [minPlayers, setMinPlayers] = useState<number | "">(2);
  const [maxPlayers, setMaxPlayers] = useState<number | "">("");
  const [pricePerPlayer, setPricePerPlayer] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [lastPreset, setLastPreset] = useState<LastMatchPreset | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);
  const lastPresetSport = lastPreset
    ? resolveToCanonicalGameId(lastPreset.sport) || lastPreset.sport
    : null;

  // ── Step 3 UI state ──
  const [timeAnchor, setTimeAnchor] = useState<HTMLElement | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [minOpen, setMinOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  // ── Success screen (shown after the match is published) ──
  const [createdMatch, setCreatedMatch] = useState<{ id: string; pending: boolean } | null>(null);

  // ── Add Field dialog ──
  const [openAddField, setOpenAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldSport, setNewFieldSport] = useState("football");
  const [newFieldLat, setNewFieldLat] = useState("");
  const [newFieldLng, setNewFieldLng] = useState("");
  const [newFieldPrice, setNewFieldPrice] = useState<number | "">("");
  const [dialogMapCenter, setDialogMapCenter] = useState<[number, number]>(BELGRADE);
  const [dialogMarkerPosition, setDialogMarkerPosition] = useState<[number, number] | null>(null);

  // Formal: field sports ∩ preferred
  const allowedFieldSports = useMemo(() => {
    if (!selectedField) return sportOptions.map((o) => o.value);
    const fieldSports = getFieldSports(selectedField);
    if (fieldSports.length === 0) return sportOptions.map((o) => o.value);
    return intersectFieldSportsWithPreferred(fieldSports, preferredSports);
  }, [selectedField, preferredSports, sportOptions]);

  const matchingFields = useMemo(() => {
    const gameIds = sport ? [sport] : preferredSports;
    const filtered = fields.filter((field) => fieldOffersAnyPreferred(field, gameIds));
    if (!userLocation) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.lat == null || a.lng == null) return 1;
      if (b.lat == null || b.lng == null) return -1;
      return (
        getDistance(userLocation[0], userLocation[1], a.lat, a.lng) -
        getDistance(userLocation[0], userLocation[1], b.lat, b.lng)
      );
    });
  }, [fields, userLocation, sport, preferredSports]);

  const steps = ["Igra", "Mesto", "Termin i igrači"];
  const stepTitles = ["Šta igramo?", "Gde igrate?", "Kada i koliko vas treba?"];
  const stepSubtitles = [
    "Izaberi sport za svoj meč.",
    "Izaberi lokaciju za meč.",
    "Izaberi termin i broj igrača.",
  ];

  function applyGameTypeDefaults(gameId: string) {
    const game = getGameType(gameId);
    if (!game) return;
    setMinPlayers(game.defaultMinPlayers);
    setMaxPlayers(game.defaultMaxPlayers);
  }

  function handleSportChange(gameId: string) {
    setSport(gameId);
    applyGameTypeDefaults(gameId);
    const presetSport = lastPreset
      ? resolveToCanonicalGameId(lastPreset.sport) || lastPreset.sport
      : null;
    if (presetSport !== gameId) setPresetApplied(false);
  }

  function applyLocationToInformal(loc: [number, number]) {
    setInformalMapCenter(loc);
    setInformalMarkerPosition(loc);
  }

  function applyLocationToDialog(loc: [number, number]) {
    setDialogMapCenter(loc);
    setDialogMarkerPosition(loc);
    setNewFieldLat(loc[0].toFixed(6));
    setNewFieldLng(loc[1].toFixed(6));
  }

  function persistUserLocation(loc: [number, number]) {
    api
      .post("/api/players/location", { lat: loc[0], lng: loc[1] })
      .catch(() => {
        /* non-blocking */
      });
  }

  function resolveUserLocation(forceRefresh = false) {
    setLocationLoading(true);
    setLocationError(null);

    const cached = user?.lastKnownLocation;
    if (!forceRefresh && cached?.lat != null && cached?.lng != null) {
      const loc: [number, number] = [cached.lat, cached.lng];
      setUserLocation((prev) => prev || loc);
      applyLocationToInformal(loc);
    }

    if (!navigator.geolocation) {
      setLocationLoading(false);
      setLocationError("Geolokacija nije podržana u pretraživaču.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        applyLocationToInformal(loc);
        persistUserLocation(loc);
        setLocationLoading(false);
        setLocationError(null);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocationLoading(false);
        const hasCache = cached?.lat != null && cached?.lng != null;
        if (!hasCache) {
          setLocationError("Nije moguće dobiti tvoju lokaciju. Omogući pristup lokaciji u pretraživaču.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: forceRefresh ? 0 : 60000 }
    );
  }

  // ── Init ──
  useEffect(() => {
    loadFields();
    resolveUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncVerification() {
      if (!isEmailVerified(userRef.current)) {
        await refreshUser();
      }
      if (!cancelled) setVerificationChecked(true);
    }

    syncVerification();

    function onVisible() {
      if (document.visibilityState === 'hidden') return;
      if (!isEmailVerified(userRef.current)) {
        void refreshUser();
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUser, user?._id]);

  // Default sport from preferred list (keep a preselected field's matching game)
  useEffect(() => {
    if (preferredSports.length === 0) return;
    if (sport && preferredSports.includes(sport)) return;
    const preselected = fields.find((f) => f._id === fieldId);
    if (preselected) {
      const allowed = intersectFieldSportsWithPreferred(getFieldSports(preselected), preferredSports);
      if (allowed.length > 0) {
        handleSportChange(allowed[0]);
        return;
      }
    }
    handleSportChange(preferredSports[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredSports.join(",")]);

  // Drop a selected field if it no longer matches the chosen game
  useEffect(() => {
    if (!fieldId || isInformal || !sport) return;
    const field = fields.find((f) => f._id === fieldId) || selectedField;
    if (!field) return;
    if (!fieldOffersAnyPreferred(field, [sport])) {
      setFieldId("");
      setSelectedField(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  const queryFieldHandled = useRef(false);
  useEffect(() => {
    if (queryFieldHandled.current) return;
    const qFieldId = query.get("fieldId");
    if (!qFieldId || !sport || preferredSports.length === 0 || fields.length === 0) return;
    const field = fields.find((f) => f._id === qFieldId);
    if (!field) {
      queryFieldHandled.current = true;
      return;
    }
    if (!fieldOffersAnyPreferred(field, preferredSports)) {
      queryFieldHandled.current = true;
      setFieldId("");
      setError("Ovaj teren ne podržava igre koje si odabrao na profilu. Izaberi drugo mesto.");
      return;
    }
    if (!fieldOffersAnyPreferred(field, [sport])) return;
    queryFieldHandled.current = true;
    setFieldId(qFieldId);
    setActiveStep(query.get("dateTime") ? 2 : 1);
  }, [fields, sport, preferredSports, query]);

  useEffect(() => {
    if (newFieldSport && !GAME_TYPES[newFieldSport] && preferredSports[0]) {
      setNewFieldSport(preferredSports[0]);
    }
  }, [preferredSports, newFieldSport]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_MATCH_PRESET_KEY);
      if (raw) setLastPreset(JSON.parse(raw) as LastMatchPreset);
    } catch {
      // ignore corrupt preset
    }
  }, []);

  useEffect(() => {
    const dateTimeParam = query.get("dateTime");
    if (dateTimeParam) {
      const parsedDateTime = roundToFullHour(dateTimeParam);
      setSelectedDateTime(parsedDateTime);
      setSelectedDate(parsedDateTime.split("T")[0]);
    }
    if (!isInformal && fieldId) {
      loadFieldDetailsAndSlots();
    } else if (!isInformal) {
      setSelectedField(null);
      setAvailableTimeSlots([]);
      if (!dateTimeParam) setSelectedDateTime("");
    }
  }, [fieldId, query, isInformal]);

  function roundToFullHour(dateTimeString: string): string {
    if (!dateTimeString) return dateTimeString;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeString)) {
      return dateTimeString.replace(/:\d{2}$/, ":00");
    }
    const d = new Date(dateTimeString);
    d.setMinutes(0); d.setSeconds(0); d.setMilliseconds(0);
    return formatLocalDateTime(d);
  }

  function formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function getAvailableInformalHours(date: string): string[] {
    if (!date) return [];

    const minAllowedDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    minAllowedDate.setMinutes(0, 0, 0);

    return Array.from({ length: 24 }, (_, hour) => hour)
      .map((hour) => `${String(hour).padStart(2, "0")}:00`)
      .filter((time) => {
        const candidate = new Date(`${date}T${time}`);
        return !Number.isNaN(candidate.getTime()) && candidate >= minAllowedDate;
      });
  }

  function loadFields() {
    api.get("/api/fields").then((res) => setFields(res.data));
  }

  async function loadFieldDetailsAndSlots() {
    if (!fieldId) return;
    try {
      setLoadingSlots(true);
      const fieldRes = await api.get<Field>(`/api/fields/${fieldId}`);
      const field = fieldRes.data;
      setSelectedField(field);
      const fieldSports = getFieldSports(field);
      const allowed = intersectFieldSportsWithPreferred(fieldSports, preferredSports);
      if (allowed.length > 0) {
        if (!allowed.includes(sport)) {
          handleSportChange(allowed[0]);
        }
      } else if (preferredSports.length > 0) {
        setError(
          "Ovaj teren ne podržava igre koje si odabrao na profilu. Izaberi drugi teren ili ažuriraj omiljene igre."
        );
      }
      const matchesRes = await api.get<Match[]>("/api/matches");
      const fieldMatches = matchesRes.data.filter(
        (m) => m.fieldId && (m.fieldId._id === fieldId || (typeof m.fieldId === "object" && m.fieldId._id === fieldId))
      );
      const slots = generateAvailableTimeSlots(field, fieldMatches);
      setAvailableTimeSlots(slots);
      const dateTimeParam = query.get("dateTime");
      if (!dateTimeParam) {
        if (slots.length > 0) {
          setSelectedDate(slots[0].date);
          setSelectedDateTime(slots[0].datetime);
        } else {
          setSelectedDate(""); setSelectedDateTime("");
        }
      }
    } catch (err) {
      setError("Neuspešno učitavanje detalja terena");
    } finally {
      setLoadingSlots(false);
    }
  }

  function generateAvailableTimeSlots(field: Field, existingMatches: Match[]): AvailableTimeSlot[] {
    const slots: AvailableTimeSlot[] = [];
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const workingHours = field.workingHours || {};
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const reservedTimes = new Set<string>();
    existingMatches.forEach((match) => {
      if (match.status !== "otkazano" && match.courtApproval !== "rejected") {
        const matchDate = new Date(match.dateTime);
        matchDate.setMinutes(0); matchDate.setSeconds(0); matchDate.setMilliseconds(0);
        reservedTimes.add(formatLocalDateTime(matchDate));
      }
    });
    for (let d = new Date(now); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = dayNames[d.getDay()];
      const dayHours = workingHours[dayOfWeek];
      if (!dayHours || dayHours.closed) continue;
      const startHour = dayHours.start ? parseInt(dayHours.start.split(":")[0]) : 9;
      const endHour = dayHours.end ? parseInt(dayHours.end.split(":")[0]) : 22;
      for (let hour = startHour; hour < endHour; hour++) {
        const slotDate = new Date(d);
        slotDate.setHours(hour, 0, 0, 0);
        if (slotDate <= now) continue;
        const datetime = formatLocalDateTime(slotDate);
        if (reservedTimes.has(datetime)) continue;
        const dateStr = slotDate.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
        const timeStr = `${hour.toString().padStart(2, "0")}:00`;
        const dateOnly = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, "0")}-${String(slotDate.getDate()).padStart(2, "0")}`;
        slots.push({ date: dateOnly, time: timeStr, datetime, display: `${dateStr} ${timeStr}` });
      }
    }
    return slots.sort((a, b) => a.datetime.localeCompare(b.datetime));
  }

  // ── Geolocation helpers ──
  function getUserLocationForDialog() {
    if (userLocation) {
      applyLocationToDialog(userLocation);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        applyLocationToDialog(loc);
        persistUserLocation(loc);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handleInformalMapClick(lat: number, lng: number) {
    setInformalMarkerPosition([lat, lng]);
    setInformalMapCenter([lat, lng]);
  }

  function handleDialogMapClick(lat: number, lng: number) {
    setNewFieldLat(lat.toFixed(6));
    setNewFieldLng(lng.toFixed(6));
    setDialogMarkerPosition([lat, lng]);
  }

  // ── Mode toggle ──
  function handleModeToggle(informal: boolean) {
    setIsInformal(informal);
    setError(null);
    setSelectedDateTime("");
    setSelectedDate("");
    setInformalRegistrationDeadlineHours(1);
    setPresetApplied(false);
    if (informal) {
      setFieldId("");
      setSelectedField(null);
      if (userLocation) applyLocationToInformal(userLocation);
      else resolveUserLocation();
    }
  }

  function applyLastPreset() {
    if (!lastPreset) return;
    const presetSport = resolveToCanonicalGameId(lastPreset.sport) || lastPreset.sport;
    if (!preferredSports.includes(presetSport)) {
      setError("Prošli meč je za igru koju više nemaš u omiljenim. Dodaj je na profilu ili izaberi drugu igru.");
      return;
    }
    setIsInformal(lastPreset.isInformal);
    handleSportChange(presetSport);
    setPricePerPlayer(lastPreset.pricePerPlayer);
    setSelectedDateTime("");
    setSelectedDate("");
    setError(null);
    setPresetApplied(true);

    if (lastPreset.isInformal) {
      setInformalLocationName(lastPreset.informalLocationName || "");
      // Always pin to current user location
      if (userLocation) applyLocationToInformal(userLocation);
      else resolveUserLocation();
      setInformalRegistrationDeadlineHours(lastPreset.informalRegistrationDeadlineHours || 1);
      setFieldId("");
      setActiveStep(2);
    } else if (lastPreset.fieldId) {
      setFieldId(lastPreset.fieldId);
      setActiveStep(2);
    } else {
      setActiveStep(1);
    }
  }

  function saveLastPreset() {
    const preset: LastMatchPreset = {
      sport,
      isInformal,
      fieldId: isInformal ? undefined : fieldId,
      fieldName: isInformal ? undefined : selectedField?.name,
      informalLocationName: isInformal ? informalLocationName.trim() : undefined,
      informalLat: isInformal ? informalMarkerPosition?.[0] : undefined,
      informalLng: isInformal ? informalMarkerPosition?.[1] : undefined,
      minPlayers: toNumberOr(minPlayers, 2),
      maxPlayers,
      pricePerPlayer,
      informalRegistrationDeadlineHours: isInformal ? informalRegistrationDeadlineHours : undefined,
    };
    localStorage.setItem(LAST_MATCH_PRESET_KEY, JSON.stringify(preset));
  }

  // ── Navigation ──
  const handleNext = () => {
    if (activeStep === 0) {
      if (preferredSports.length === 0) {
        setError("Prvo odaberi omiljene igre na profilu");
        return;
      }
      if (!sport || !preferredSports.includes(sport)) {
        setError("Odaberi igru / sport za meč");
        return;
      }
    }
    if (activeStep === 1) {
      if (isInformal) {
        if (!informalLocationName.trim() || !informalMarkerPosition) {
          setError("Molimo unesite naziv lokacije i označite tačku na mapi");
          return;
        }
      } else if (!fieldId) {
        setError("Molimo odaberite mesto");
        return;
      }
    }
    if (activeStep === 2) {
      if (!isInformal && allowedFieldSports.length === 0) {
        setError("Ovaj teren ne podržava tvoje omiljene igre");
        return;
      }
      if (!selectedDateTime) {
        setError("Molimo odaberite termin");
        return;
      }
      onSubmit();
      return;
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => { setActiveStep((prev) => prev - 1); setError(null); };

  // ── Submit ──
  async function onSubmit() {
    if (!user) {
      setError("Morate biti ulogovani da biste kreirali meč");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }
    if (preferredSports.length === 0) {
      setError("Prvo odaberi omiljene igre na profilu da bi mogao da kreiraš meč.");
      return;
    }
    if (!sport || !preferredSports.includes(sport)) {
      setError("Možeš kreirati meč samo za igre koje si odabrao na profilu.");
      return;
    }
    try {
      const roundedLocal = roundToFullHour(selectedDateTime);
      // Send absolute ISO so server timezone doesn't shift the wall-clock time
      const localDate = new Date(roundedLocal);
      const dateTimeToSend = Number.isNaN(localDate.getTime())
        ? roundedLocal
        : localDate.toISOString();

      let payload: Record<string, unknown> = {
        sport,
        dateTime: dateTimeToSend,
        minPlayers: toNumberOr(minPlayers, 1),
        maxPlayers: maxPlayers === "" ? undefined : maxPlayers,
      };

      if (pricePerPlayer !== "" && Number(pricePerPlayer) >= 0) {
        payload.pricePerPlayer = Number(pricePerPlayer);
      }

      if (isInformal) {
        payload = {
          ...payload,
          isInformal: true,
          informalLocation: {
            name: informalLocationName.trim(),
            lat: informalMarkerPosition![0],
            lng: informalMarkerPosition![1],
          },
          informalRegistrationDeadlineHours,
        };
      } else {
        payload = { ...payload, fieldId };
      }

      const res = await api.post<Match>("/api/matches", payload);
      saveLastPreset();
      setCreatedMatch({ id: res.data._id, pending: res.data.courtApproval === "pending" });
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("Niste autentifikovani. Molimo ulogujte se ponovo.");
        setTimeout(() => navigate("/login"), 2000);
      } else if (err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setError(err.response.data.message || "Potvrdi email da bi kreirao meč.");
      } else {
        setError(err.response?.data?.message || "Neuspešno kreiranje meča");
      }
    }
  }

  // ── Add Field dialog ──
  function handleDialogClose() {
    setOpenAddField(false);
    setError(null);
    setNewFieldName(""); setNewFieldLat(""); setNewFieldLng("");
    setNewFieldPrice(""); setDialogMarkerPosition(null);
    setDialogMapCenter(userLocation || BELGRADE);
  }

  function handleOpenAddField() {
    setNewFieldSport(sport || preferredSports[0] || "football");
    if (userLocation) applyLocationToDialog(userLocation);
    else getUserLocationForDialog();
    setOpenAddField(true);
  }

  async function handleAddField() {
    if (!newFieldName || !newFieldLat || !newFieldLng) {
      setError("Molimo popunite sva polja i odaberite lokaciju na mapi");
      return;
    }
    try {
      const res = await api.post<Field>("/api/fields", {
        name: newFieldName,
        sport: newFieldSport,
        lat: parseFloat(newFieldLat),
        lng: parseFloat(newFieldLng),
        price: toNumberOr(newFieldPrice, 0),
        registrationDeadlineHours: 0,
      });
      setFields([...fields, res.data]);
      handleSportChange(newFieldSport);
      setFieldId(res.data._id);
      handleDialogClose();
    } catch {
      setError("Neuspešno dodavanje terena");
    }
  }

  // ── Slot grouping ──
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailableTimeSlot[]> = {};
    availableTimeSlots.forEach(slot => {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    });
    return grouped;
  }, [availableTimeSlots]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fiveDaysLater = new Date(today); fiveDaysLater.setDate(today.getDate() + 5);
  const availableDates = Object.keys(slotsByDate)
    .filter(dateStr => { const d = new Date(dateStr); return d >= today && d <= fiveDaysLater; })
    .sort();

  // Next 14 days that still have at least one bookable hour (informal matches)
  const informalDates = useMemo(() => {
    if (!isInformal) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = formatLocalDateTime(d).split("T")[0];
      if (getAvailableInformalHours(dateStr).length > 0) out.push(dateStr);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInformal, activeStep]);

  // Informal: preselect the first available date + hour when entering the last step
  useEffect(() => {
    if (activeStep !== 2 || !isInformal || selectedDateTime) return;
    const firstDate = informalDates[0];
    if (!firstDate) return;
    const firstHour = getAvailableInformalHours(firstDate)[0];
    if (firstHour) {
      setSelectedDate(firstDate);
      setSelectedDateTime(`${firstDate}T${firstHour}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, isInformal, selectedDateTime, informalDates]);

  // ── Step content ──
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderStepGame();
      case 1:
        return renderStepPlace();
      case 2:
        return renderStepWhen();
      default:
        return null;
    }
  };

  function renderStepGame() {
    const showLastPreset =
      Boolean(lastPreset) &&
      !presetApplied &&
      Boolean(lastPresetSport && preferredSports.includes(lastPresetSport));
    const lastGame = lastPreset ? getGameType(lastPresetSport || lastPreset.sport) : null;

    return (
      <Stack spacing="24px">
        {error && <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {preferredSports.map((id, idx) => {
            const game = getGameType(id);
            const selected = sport === id;
            const isLastOdd = preferredSports.length % 2 === 1 && idx === preferredSports.length - 1;
            return (
              <ButtonBase
                key={id}
                aria-pressed={selected}
                onClick={() => {
                  handleSportChange(id);
                  setError(null);
                }}
                sx={(t) => ({
                  gridColumn: isLastOdd ? "1 / -1" : undefined,
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: "6px",
                  minHeight: 142,
                  p: selected ? "15px" : "16px",
                  borderRadius: "16px",
                  border: selected ? "2px solid" : "1px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: selected ? alpha(t.palette.primary.main, 0.07) : "background.paper",
                  textAlign: "center",
                })}
              >
                <SportIcon sport={id} size={56} />
                <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: "text.primary" }}>
                  {game?.name || getGameTypeName(id)}
                </Typography>
                {game && (
                  <Box>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.35, color: "text.secondary" }}>
                      {formatPlayersRange(game.defaultMinPlayers, game.defaultMaxPlayers)}
                    </Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.35, color: "text.secondary" }}>
                      igrača
                    </Typography>
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>

        {showLastPreset && lastPreset && (
          <Box>
            <Typography sx={{ fontSize: 17, fontWeight: 800, mb: "12px" }}>Isto kao prošli put?</Typography>
            <ButtonBase
              onClick={applyLastPreset}
              sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                p: "14px 16px",
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                textAlign: "left",
              }}
            >
              <SportIcon sport={lastPresetSport || lastPreset.sport} size={32} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
                  {lastGame?.name || getGameTypeName(lastPreset.sport)}
                </Typography>
                <Typography noWrap sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.4 }}>
                  {lastPreset.isInformal
                    ? lastPreset.informalLocationName || "Privatni teren"
                    : lastPreset.fieldName || "Teren"}
                  {" · "}
                  {lastPreset.maxPlayers !== "" ? lastPreset.maxPlayers : lastPreset.minPlayers} igrača
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "text.secondary" }} />
            </ButtonBase>
          </Box>
        )}
      </Stack>
    );
  }

  function renderStepPlace() {
    return (
      <Stack spacing="24px">
        {error && <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>}
        <Stack spacing="12px">
          <ChoiceCard
            icon={<AccountBalanceOutlinedIcon />}
            title="Na terenu / u lokalu"
            description="Izaberi postojeći teren ili lokal sa terenom"
            selected={!isInformal}
            onClick={() => handleModeToggle(false)}
          />
          <ChoiceCard
            icon={<PlaceOutlinedIcon />}
            title="Negde drugde"
            description="Park, škola, drugi teren…"
            selected={isInformal}
            onClick={() => handleModeToggle(true)}
          />
        </Stack>
        {isInformal ? renderInformalLocation() : renderFormalFields()}
      </Stack>
    );
  }

  function renderInformalLocation() {
    return (
      <Stack spacing={3}>
        <TextField
          label="Naziv lokacije"
          placeholder="npr. Dvorište kod škole, Park Tašmajdan, Moj teren..."
          value={informalLocationName}
          onChange={(e) => setInformalLocationName(e.target.value)}
          required
          fullWidth
          helperText="Kratki opis mesta gde se igra"
        />

        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Lokacija meča
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Koristi se tvoja trenutna lokacija. Možeš pomeriti tačku klikom na mapu.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Button
              startIcon={locationLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
              onClick={() => resolveUserLocation(true)}
              size="small"
              disabled={locationLoading}
            >
              Osveži moju lokaciju
            </Button>
            {userLocation && !locationLoading && (
              <Typography variant="caption" color="success.main" fontWeight={600}>
                Lokacija aktivna
              </Typography>
            )}
          </Stack>
          {locationError && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              {locationError}
            </Alert>
          )}
          <Paper
            elevation={0}
            sx={{
              height: { xs: 220, sm: 300 }, borderRadius: 3, overflow: "hidden",
              border: "2px solid", borderColor: informalMarkerPosition ? "primary.main" : "divider",
            }}
          >
            <MapContainer
              center={informalMapCenter}
              zoom={informalMarkerPosition ? 15 : 13}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom
              key={`informal-${informalMapCenter[0]}-${informalMapCenter[1]}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapCenter position={informalMapCenter} />
              <MapClickHandler onMapClick={handleInformalMapClick} />
              {informalMarkerPosition && <Marker position={informalMarkerPosition} />}
            </MapContainer>
          </Paper>
          {informalMarkerPosition && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2, borderRadius: 2 }}>
              Lokacija označena: {informalMarkerPosition[0].toFixed(5)}, {informalMarkerPosition[1].toFixed(5)}
            </Alert>
          )}
        </Box>
      </Stack>
    );
  }

  function renderFormalFields() {
    return (
      <Box>
        <Typography sx={{ fontSize: 17, fontWeight: 800, mb: "14px" }}>Popularni tereni u blizini</Typography>
        {locationError && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>{locationError}</Alert>
        )}
        {matchingFields.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            Nema mesta za {sport ? getGameTypeName(sport) : "tvoje igre"}. Dodaj mesto ili izaberi „Negde drugde“.
          </Alert>
        ) : (
          <Stack spacing="14px" role="radiogroup" aria-label="Popularni tereni u blizini">
            {matchingFields.map((field) => {
              const checked = fieldId === field._id;
              const distanceKm =
                userLocation && field.lat != null && field.lng != null
                  ? getDistance(userLocation[0], userLocation[1], field.lat, field.lng)
                  : null;
              const fieldSports = getFieldSports(field);
              const rowSport = sport && fieldSports.some((s) => (resolveToCanonicalGameId(s) || s) === sport)
                ? sport
                : resolveToCanonicalGameId(fieldSports[0] || "") || fieldSports[0] || sport;
              const subtitleParts = [
                distanceKm != null ? formatDistanceKm(distanceKm) : null,
                sport ? getGameTypeName(sport) : fieldSports.map((s) => getGameTypeName(s)).join(", "),
                field.price && field.price > 0 ? `${field.price} EUR` : null,
              ].filter(Boolean);
              return (
                <ButtonBase
                  key={field._id}
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setFieldId(field._id)}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    textAlign: "left",
                    borderRadius: "14px",
                  }}
                >
                  <Box
                    sx={(t) => ({
                      width: 56,
                      height: 56,
                      flexShrink: 0,
                      borderRadius: "12px",
                      bgcolor: alpha(t.palette.primary.main, 0.08),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <SportIcon sport={rowSport || "football"} size={30} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{field.name}</Typography>
                    <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.4 }}>
                      {subtitleParts.join(" · ")}
                    </Typography>
                  </Box>
                  <RadioDot checked={checked} />
                </ButtonBase>
              );
            })}
          </Stack>
        )}
        <Button
          startIcon={<AddIcon />}
          onClick={handleOpenAddField}
          sx={{ mt: "12px", ml: "-8px", fontWeight: 700 }}
        >
          Dodaj mesto
        </Button>
      </Box>
    );
  }

  function getDeadlineCaption(): string | null {
    if (!selectedDateTime) return null;
    const matchDate = new Date(selectedDateTime);
    if (Number.isNaN(matchDate.getTime())) return null;
    if (isInformal) {
      const d = new Date(matchDate.getTime() - informalRegistrationDeadlineHours * 60 * 60 * 1000);
      return `${formatShortDateTime(d)} · ${informalRegistrationDeadlineHours} ${informalRegistrationDeadlineHours === 1 ? "sat" : "sati"} pre meča`;
    }
    if (!selectedField) return null;
    const deadlineHours = selectedField.registrationDeadlineHours ?? 0;
    let deadline = new Date(matchDate.getTime() - deadlineHours * 60 * 60 * 1000);
    const minLead = new Date(matchDate.getTime() - 30 * 60 * 1000);
    let note = deadlineHours === 0 ? "do početka meča" : `${deadlineHours} sati pre meča`;
    if (deadline.getTime() < Date.now()) {
      deadline = minLead;
      note = "prilagođeno (meč je ranije od standardnog roka terena)";
    }
    return `${formatShortDateTime(deadline)} · ${note}`;
  }

  function renderStepWhen() {
    const dates = isInformal ? informalDates : availableDates;
    const selectedDay = selectedDateTime ? selectedDateTime.split("T")[0] : "";
    const selectedTime = selectedDateTime ? selectedDateTime.split("T")[1] : "";
    const timesForDate = (date: string): string[] =>
      isInformal ? getAvailableInformalHours(date) : (slotsByDate[date] || []).map((s) => s.time);
    const times = selectedDay ? timesForDate(selectedDay) : [];

    const handleDayPick = (date: string) => {
      const options = timesForDate(date);
      const nextTime = options.includes(selectedTime) ? selectedTime : options[0];
      if (!nextTime) return;
      setSelectedDate(date);
      setSelectedDateTime(`${date}T${nextTime}`);
    };

    const playersShown = maxPlayers === "" ? toNumberOr(minPlayers, 1) : maxPlayers;
    const changePlayers = (delta: number) => {
      const next = Math.min(99, Math.max(1, playersShown + delta));
      setMaxPlayers(next);
      if (typeof minPlayers === "number" && next < minPlayers) setMinPlayers(next);
    };

    const deadlineCaption = getDeadlineCaption();
    const noSlots = !isInformal && !loadingSlots && dates.length === 0;

    return (
      <Stack spacing="24px">
        {error && <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>}
        {presetApplied && (
          <Alert severity="success" sx={{ borderRadius: '12px' }} onClose={() => setPresetApplied(false)}>
            Postavke prethodnog meča su primenjene — samo odaberi novi termin.
          </Alert>
        )}
        {!isInformal && allowedFieldSports.length === 0 && (
          <Alert severity="warning" sx={{ borderRadius: '12px' }}>
            Teren ne podržava tvoje omiljene igre. Izaberi drugi teren ili ažuriraj profil.
          </Alert>
        )}

        {loadingSlots ? (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>Učitavanje dostupnih termina...</Alert>
        ) : noSlots ? (
          <Alert severity="warning" sx={{ borderRadius: '12px' }}>
            Nema dostupnih termina za ovaj teren u narednih 30 dana. Proverite radno vreme terena.
          </Alert>
        ) : (
          <>
            <Box sx={{ mx: "-10px" }}>
            <Box
              role="radiogroup"
              aria-label="Datum"
              sx={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                px: "10px",
                pb: "2px",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {dates.map((date) => {
                const { top, bottom } = getDayChipLabels(date);
                const selected = selectedDay === date;
                return (
                  <ButtonBase
                    key={date}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleDayPick(date)}
                    sx={{
                      flexShrink: 0,
                      flexDirection: "column",
                      minWidth: 72,
                      height: 72,
                      borderRadius: "14px",
                      border: "1px solid",
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: selected ? "primary.main" : "background.paper",
                      color: selected ? "primary.contrastText" : "text.primary",
                    }}
                  >
                    <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: "inherit" }}>{top}</Typography>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.3, color: "inherit", opacity: selected ? 0.9 : 0.7 }}>
                      {bottom}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 800, mb: "12px" }}>Vreme</Typography>
              <ButtonBase
                onClick={(e) => setTimeAnchor(e.currentTarget)}
                disabled={times.length === 0}
                aria-haspopup="listbox"
                sx={{
                  width: "100%",
                  justifyContent: "space-between",
                  minHeight: 56,
                  px: "16px",
                  borderRadius: "14px",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Stack direction="row" spacing="12px" alignItems="center">
                  <AccessTimeIcon sx={{ color: "text.secondary" }} />
                  <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{selectedTime || "—"}</Typography>
                </Stack>
                <ChevronRightIcon sx={{ color: "text.secondary" }} />
              </ButtonBase>
              <Menu
                anchorEl={timeAnchor}
                open={Boolean(timeAnchor)}
                onClose={() => setTimeAnchor(null)}
                slotProps={{ paper: { sx: { maxHeight: 320, minWidth: timeAnchor?.clientWidth, borderRadius: "14px" } } }}
              >
                {times.map((time) => (
                  <MenuItem
                    key={time}
                    selected={time === selectedTime}
                    onClick={() => {
                      if (selectedDay) setSelectedDateTime(`${selectedDay}T${time}`);
                      setTimeAnchor(null);
                    }}
                  >
                    {time}
                  </MenuItem>
                ))}
              </Menu>
              {deadlineCaption && (
                <Typography sx={{ mt: "8px", fontSize: 13, color: "text.secondary" }}>
                  Rok za prijavu: {deadlineCaption}
                </Typography>
              )}
            </Box>
          </>
        )}

        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 800, mb: "12px" }}>Broj igrača</Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton
              aria-label="Manje igrača"
              onClick={() => changePlayers(-1)}
              disabled={playersShown <= 1}
              sx={stepperButtonSx}
            >
              <RemoveIcon />
            </IconButton>
            <Typography aria-live="polite" sx={{ fontSize: 28, fontWeight: 800 }}>{playersShown}</Typography>
            <IconButton aria-label="Više igrača" onClick={() => changePlayers(1)} sx={stepperButtonSx}>
              <AddIcon />
            </IconButton>
          </Stack>
        </Box>

        <Stack spacing="12px">
          <ExpandRow
            title="Podela troškova (opciono)"
            value={pricePerPlayer !== "" ? `${pricePerPlayer} RSD` : undefined}
            open={priceOpen}
            onToggle={() => setPriceOpen((v) => !v)}
          >
            <TextField
              type="text"
              label="Cena po igraču (RSD)"
              value={pricePerPlayer}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              fullWidth
              onFocus={selectNumberField}
              onChange={(e) => {
                const value = parseIntegerInput(e.target.value);
                if (value === null) return;
                if (value === "" || value >= 0) setPricePerPlayer(value);
              }}
              helperText="Npr. 400 — prikazuje se u detaljima meča"
              placeholder="npr. 400"
            />
          </ExpandRow>
          <ExpandRow
            title="Minimalan broj igrača"
            value={String(toNumberOr(minPlayers, 1))}
            open={minOpen}
            onToggle={() => setMinOpen((v) => !v)}
          >
            <TextField
              type="text"
              label="Minimalni broj igrača"
              value={minPlayers}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
              fullWidth
              onFocus={selectNumberField}
              onChange={(e) => {
                const value = parseIntegerInput(e.target.value);
                if (value === null) return;
                if (value === "") { setMinPlayers(""); return; }
                if (value >= 1) {
                  setMinPlayers(value);
                  if (typeof maxPlayers === "number" && maxPlayers < value) setMaxPlayers(value);
                }
              }}
              onBlur={() => {
                if (minPlayers === "" || minPlayers < 1) setMinPlayers(1);
              }}
              helperText="Meč se potvrđuje kada se prijavi najmanje toliko igrača"
            />
          </ExpandRow>
          {isInformal && (
            <ExpandRow
              title="Rok za prijavu"
              value={`${informalRegistrationDeadlineHours} ${informalRegistrationDeadlineHours === 1 ? "sat" : "sati"} pre`}
              open={deadlineOpen}
              onToggle={() => setDeadlineOpen((v) => !v)}
            >
              <TextField
                select
                fullWidth
                label="Rok za prijavu (sati pre meča)"
                value={informalRegistrationDeadlineHours}
                onChange={(e) => setInformalRegistrationDeadlineHours(Number(e.target.value))}
                helperText="Za privatne mečeve ti biraš kada se prijave zatvaraju."
              >
                {[1, 2, 3, 4, 6, 8, 12, 24, 36, 48].map((h) => (
                  <MenuItem key={h} value={h}>{h} {h === 1 ? "sat" : "sati"} pre</MenuItem>
                ))}
              </TextField>
            </ExpandRow>
          )}
        </Stack>
      </Stack>
    );
  }

  function renderSuccess(created: { id: string; pending: boolean }) {
    const confetti = [
      { top: "4%", left: "22%", color: "#F59E0B", size: 9, round: false, rot: 20 },
      { top: "10%", left: "62%", color: "#0877F9", size: 8, round: true, rot: 0 },
      { top: "2%", left: "80%", color: "#F97316", size: 9, round: false, rot: -25 },
      { top: "26%", left: "92%", color: "#22A559", size: 8, round: false, rot: 35 },
      { top: "38%", left: "2%", color: "#0877F9", size: 9, round: false, rot: -15 },
      { top: "22%", left: "8%", color: "#F97316", size: 7, round: true, rot: 0 },
      { top: "70%", left: "6%", color: "#F59E0B", size: 8, round: false, rot: 40 },
      { top: "66%", left: "90%", color: "#7C3AED", size: 8, round: true, rot: 0 },
      { top: "90%", left: "74%", color: "#0877F9", size: 7, round: false, rot: -30 },
      { top: "88%", left: "26%", color: "#22A559", size: 8, round: false, rot: 15 },
    ];
    return (
      <Box
        sx={{
          maxWidth: 600,
          mx: "auto",
          px: { xs: "10px", sm: 0 },
          minHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton aria-label="Zatvori" onClick={() => navigate("/")} sx={{ color: "text.secondary" }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pb: `calc(${BAR_HEIGHT * 2 + 24}px + env(safe-area-inset-bottom))`,
          }}
        >
          <Box aria-hidden sx={{ position: "relative", width: 210, height: 210, mb: "28px" }}>
            {confetti.map((c, i) => (
              <Box
                key={i}
                sx={{
                  position: "absolute",
                  top: c.top,
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  borderRadius: c.round ? "50%" : "2px",
                  bgcolor: c.color,
                  transform: `rotate(${c.rot}deg)`,
                }}
              />
            ))}
            <Box
              sx={{
                position: "absolute",
                inset: 25,
                borderRadius: "50%",
                bgcolor: "rgba(34, 165, 89, 0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  width: 112,
                  height: 112,
                  borderRadius: "50%",
                  bgcolor: "#22A559",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckIcon sx={{ fontSize: 64, color: "#fff" }} />
              </Box>
            </Box>
          </Box>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 28, sm: 30 }, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em", mb: "12px" }}
          >
            Meč je objavljen.
          </Typography>
          <Typography sx={{ fontSize: 16, lineHeight: 1.5, color: "text.secondary" }}>
            <Box component="span" sx={{ display: "block", maxWidth: 270, mx: "auto" }}>
              {created.pending
                ? "Teren treba da potvrdi tvoj meč."
                : "Tvoj meč je sada vidljiv drugim igračima u tvom kraju."}
            </Box>
            <Box component="span" sx={{ display: "block" }}>
              {created.pending
                ? "Obavestiće te kada bude odobren i kada se neko prijavi"
                : "Obavestiće te kada se neko prijavi"}
            </Box>
          </Typography>
        </Box>
        <Box sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1100, bgcolor: "background.default" }}>
          <Stack
            spacing="12px"
            sx={{
              maxWidth: 600,
              mx: "auto",
              px: { xs: "20px", sm: 0 },
              pt: "12px",
              pb: "calc(16px + env(safe-area-inset-bottom))",
            }}
          >
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(`/matches/${created.id}`)}
              sx={{ height: BAR_HEIGHT - 12, fontSize: 17, fontWeight: 700, borderRadius: "14px" }}
            >
              Vidi meč
            </Button>
            <Button
              fullWidth
              onClick={() => navigate("/")}
              sx={(t) => ({
                height: BAR_HEIGHT - 12,
                fontSize: 17,
                fontWeight: 700,
                borderRadius: "14px",
                color: "text.primary",
                bgcolor: alpha(t.palette.text.secondary, 0.1),
                "&:hover": { bgcolor: alpha(t.palette.text.secondary, 0.16) },
              })}
            >
              Nazad na početnu
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  if (createdMatch) return renderSuccess(createdMatch);

  const wizardReady =
    verificationChecked && isEmailVerified(user) && preferredSports.length > 0;

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: "auto",
        px: { xs: "10px", sm: 0 },
        pb: wizardReady ? `calc(${BAR_HEIGHT + 24}px + env(safe-area-inset-bottom))` : 0,
      }}
    >
      {wizardReady ? (
        <>
          <Stack direction="row" alignItems="center" spacing="10px" sx={{ mb: "20px" }}>
            <IconButton
              aria-label="Nazad"
              size="small"
              onClick={() => (activeStep > 0 ? handleBack() : navigate(-1))}
              sx={{ color: "text.secondary", ml: "-6px" }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
              {activeStep + 1} od {steps.length}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((activeStep + 1) / steps.length) * 100}
              aria-label={`Korak ${activeStep + 1} od ${steps.length}`}
              sx={(t) => ({
                flex: 1,
                height: 5,
                borderRadius: 3,
                bgcolor: alpha(t.palette.primary.main, 0.12),
                "& .MuiLinearProgress-bar": { borderRadius: 3 },
              })}
            />
          </Stack>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 26, sm: 28 }, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em", mb: "6px" }}
          >
            {stepTitles[activeStep]}
          </Typography>
          <Typography sx={{ fontSize: 15, color: "text.secondary", mb: "22px" }}>
            {stepSubtitles[activeStep]}
          </Typography>

          {renderStepContent(activeStep)}

          <Box
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1100,
              bgcolor: "background.default",
            }}
          >
            <Box
              sx={{
                maxWidth: 600,
                mx: "auto",
                px: { xs: "20px", sm: 0 },
                pt: "12px",
                pb: "calc(16px + env(safe-area-inset-bottom))",
              }}
            >
              <Button
                variant="contained"
                fullWidth
                onClick={handleNext}
                sx={{ height: BAR_HEIGHT - 12, fontSize: 17, fontWeight: 700, borderRadius: "14px" }}
              >
                {activeStep === steps.length - 1 ? "Objavi meč" : "Dalje"}
              </Button>
            </Box>
          </Box>
        </>
      ) : (
        <>
          <Typography component="h1" sx={{ fontSize: 28, fontWeight: 800, mb: "16px" }}>
            Kreiraj meč
          </Typography>
          {!verificationChecked ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : !isEmailVerified(user) ? (
            <EmailVerificationNeeded email={user?.email} />
          ) : (
            <Alert
              severity="warning"
              sx={{ borderRadius: '12px' }}
              action={
                <Button color="inherit" size="small" onClick={() => navigate("/profil?edit=igre")}>
                  Profil
                </Button>
              }
            >
              Nemaš odabrane omiljene igre. Dodaj ih na profilu da bi mogao da kreiraš meč.
            </Alert>
          )}
        </>
      )}

      {/* Add Field Dialog */}
      <Dialog
        open={openAddField}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, p: 1 } }}
      >
        <DialogTitle>
          <Typography variant="h5" fontWeight={700}>Dodaj novo mesto</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <TextField label="Naziv mesta" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} required fullWidth />
            <TextField select label="Igra / sport" value={newFieldSport} onChange={(e) => setNewFieldSport(e.target.value)} required fullWidth>
              {getSportSelectOptions(preferredSports.length ? preferredSports : undefined).map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
            <TextField
              type="text"
              label="Cena (EUR) - opciono"
              value={newFieldPrice}
              onFocus={selectNumberField}
              onChange={(e) => {
                const value = parseNumberInput(e.target.value);
                if (value === null) return;
                if (value === "" || value >= 0) setNewFieldPrice(value);
              }}
              fullWidth
              inputProps={{ inputMode: "decimal" }}
            />
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Lokacija mesta</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Podrazumevano se koristi tvoja lokacija. Možeš pomeriti tačku klikom na mapu.
              </Typography>
              <Button startIcon={<MyLocationIcon />} onClick={getUserLocationForDialog} size="small" sx={{ mb: 2 }}>
                Osveži moju lokaciju
              </Button>
              <Paper elevation={0} sx={{ height: { xs: 220, sm: 300 }, borderRadius: 3, overflow: "hidden", border: "1px solid", borderColor: dialogMarkerPosition ? "primary.main" : "divider", borderWidth: dialogMarkerPosition ? 2 : 1 }}>
                <MapContainer center={dialogMapCenter} zoom={dialogMarkerPosition ? 15 : 13} style={{ height: "100%", width: "100%" }} scrollWheelZoom key={`dialog-${dialogMapCenter[0]}-${dialogMapCenter[1]}`}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapCenter position={dialogMapCenter} />
                  <MapClickHandler onMapClick={handleDialogMapClick} />
                  {dialogMarkerPosition && <Marker position={dialogMarkerPosition} />}
                </MapContainer>
              </Paper>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Geografska širina" value={newFieldLat} InputProps={{ readOnly: true }} fullWidth helperText={!newFieldLat ? "Kliknite na mapu" : "✓ Postavljeno"} />
              <TextField label="Geografska dužina" value={newFieldLng} InputProps={{ readOnly: true }} fullWidth helperText={!newFieldLng ? "Kliknite na mapu" : "✓ Postavljeno"} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDialogClose} variant="outlined" sx={{ borderRadius: 3, px: 3, width: { xs: "100%", sm: "auto" } }}>Otkaži</Button>
          <Button onClick={handleAddField} variant="contained" disabled={!newFieldLat || !newFieldLng || !newFieldName} sx={{ borderRadius: 3, px: 3, width: { xs: "100%", sm: "auto" } }}>Dodaj mesto</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const BAR_HEIGHT = 76;

const stepperButtonSx = {
  width: 56,
  height: 56,
  borderRadius: "14px",
  color: "primary.main",
  bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.1),
  "&:hover": { bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.16) },
  "&.Mui-disabled": { opacity: 0.45 },
} as const;

const WEEKDAYS_SHORT = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDayChipLabels(dateStr: string): { top: string; bottom: string } {
  const d = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  return {
    top: diff === 0 ? "Danas" : diff === 1 ? "Sutra" : WEEKDAYS_SHORT[d.getDay()],
    bottom: `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`,
  };
}

function formatShortDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatPlayersRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function formatDistanceKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "50%",
        border: "2px solid",
        borderColor: checked ? "primary.main" : "divider",
        bgcolor: checked ? "primary.main" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#fff" }} />}
    </Box>
  );
}

function ExpandRow({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "14px", bgcolor: "background.paper", overflow: "hidden" }}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{ width: "100%", justifyContent: "space-between", px: "16px", minHeight: 56, textAlign: "left" }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{title}</Typography>
        <Stack direction="row" alignItems="center" spacing="6px">
          {value && (
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "primary.main" }}>{value}</Typography>
          )}
          <ExpandMoreIcon
            sx={{ color: "text.secondary", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </Stack>
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: "16px", pb: "16px" }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={(t) => ({
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        textAlign: "left",
        p: selected ? "15px" : "16px",
        borderRadius: "16px",
        border: selected ? "2px solid" : "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? alpha(t.palette.primary.main, 0.07) : "background.paper",
      })}
    >
      <Box
        sx={(t) => ({
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: "12px",
          bgcolor: selected ? alpha(t.palette.primary.main, 0.12) : alpha(t.palette.text.secondary, 0.1),
          color: selected ? "primary.main" : "text.secondary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{title}</Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.4 }}>{description}</Typography>
      </Box>
      {selected && <CheckCircleIcon sx={{ color: "primary.main", alignSelf: "flex-start" }} />}
    </ButtonBase>
  );
}
