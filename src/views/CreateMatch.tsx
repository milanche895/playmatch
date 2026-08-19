'use client';

import { useEffect, useMemo, useState } from "react";
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
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  useMediaQuery,
  useTheme,
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
import { Field, Match } from "../types";
import { useAuth } from "../context/AuthContext";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  GAME_TYPES,
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
  const { user } = useAuth();
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
  const [minPlayers, setMinPlayers] = useState<number>(2);
  const [maxPlayers, setMaxPlayers] = useState<number | "">("");
  const [pricePerPlayer, setPricePerPlayer] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [lastPreset, setLastPreset] = useState<LastMatchPreset | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);

  // ── Add Field dialog ──
  const [openAddField, setOpenAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldSport, setNewFieldSport] = useState("football");
  const [newFieldLat, setNewFieldLat] = useState("");
  const [newFieldLng, setNewFieldLng] = useState("");
  const [newFieldPrice, setNewFieldPrice] = useState<number>(0);
  const [dialogMapCenter, setDialogMapCenter] = useState<[number, number]>(BELGRADE);
  const [dialogMarkerPosition, setDialogMarkerPosition] = useState<[number, number] | null>(null);

  // Formal: field sports ∩ preferred
  const allowedFieldSports = useMemo(() => {
    if (!selectedField) return sportOptions.map((o) => o.value);
    const fieldSports = selectedField.sports || (selectedField.sport ? [selectedField.sport] : []);
    if (fieldSports.length === 0) return sportOptions.map((o) => o.value);
    return intersectFieldSportsWithPreferred(fieldSports, preferredSports);
  }, [selectedField, preferredSports, sportOptions]);

  const fieldsNearUser = useMemo(() => {
    if (!userLocation) return fields;
    return [...fields].sort((a, b) => {
      if (a.lat == null || a.lng == null) return 1;
      if (b.lat == null || b.lng == null) return -1;
      return (
        getDistance(userLocation[0], userLocation[1], a.lat, a.lng) -
        getDistance(userLocation[0], userLocation[1], b.lat, b.lng)
      );
    });
  }, [fields, userLocation]);

  // 2 koraka: lokacija → termin + igrači
  const steps = isInformal
    ? ["Lokacija", "Termin i igrači"]
    : ["Teren", "Termin i igrači"];

  function applyGameTypeDefaults(gameId: string) {
    const game = getGameType(gameId);
    if (!game) return;
    setMinPlayers(game.defaultMinPlayers);
    setMaxPlayers(game.defaultMaxPlayers);
  }

  function handleSportChange(gameId: string) {
    setSport(gameId);
    applyGameTypeDefaults(gameId);
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

  // Default sport from preferred list
  useEffect(() => {
    if (preferredSports.length === 0) return;
    if (!sport || !preferredSports.includes(sport)) {
      handleSportChange(preferredSports[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredSports.join(",")]);

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
      const fieldSports = field.sports || (field.sport ? [field.sport] : []);
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
    setActiveStep(0);
    setError(null);
    setSelectedDateTime("");
    setSelectedDate("");
    setInformalRegistrationDeadlineHours(1);
    setPresetApplied(false);
    if (informal) {
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
      setActiveStep(1);
    } else if (lastPreset.fieldId) {
      setFieldId(lastPreset.fieldId);
      setActiveStep(1);
    } else {
      setActiveStep(0);
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
      minPlayers,
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
      if (isInformal) {
        if (!informalLocationName.trim() || !informalMarkerPosition) {
          setError("Molimo unesite naziv lokacije i označite tačku na mapi");
          return;
        }
      } else {
        if (!fieldId) {
          setError("Molimo odaberite teren");
          return;
        }
      }
    }
    if (activeStep === 1) {
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
        minPlayers,
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
      navigate(`/matches/${res.data._id}`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("Niste autentifikovani. Molimo ulogujte se ponovo.");
        setTimeout(() => navigate("/login"), 2000);
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
    setNewFieldPrice(0); setDialogMarkerPosition(null);
    setDialogMapCenter(userLocation || BELGRADE);
  }

  function handleOpenAddField() {
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
        price: newFieldPrice,
        registrationDeadlineHours: 0,
      });
      setFields([...fields, res.data]);
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

  // ── Step content ──
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return isInformal ? renderStep0Informal() : renderStep0Formal();
      case 1:
        return renderStep1Combined();
      default:
        return null;
    }
  };

  function renderPlayersAndPriceFields() {
    return (
      <>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" fontWeight={600}>Broj igrača</Typography>
        <TextField
          type="number" label="Minimalni broj igrača" value={minPlayers}
          inputProps={{ min: 1 }} required fullWidth
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { setMinPlayers(1); return; }
            const value = Number(raw);
            if (value >= 1) {
              setMinPlayers(value);
              if (typeof maxPlayers === "number" && maxPlayers < value) setMaxPlayers("");
            }
          }}
        />
        <TextField
          type="number" label="Maksimalni broj igrača (opciono)" value={maxPlayers}
          inputProps={{ min: minPlayers }} fullWidth
          onChange={(e) => {
            const value = e.target.value === "" ? "" : parseInt(e.target.value);
            if (value === "" || (!isNaN(value as number) && (value as number) >= minPlayers)) setMaxPlayers(value);
          }}
          helperText={maxPlayers === "" ? "Ostavite prazno ako nema maksimuma" : `Maksimum: ${maxPlayers} igrača`}
        />
        <Typography variant="subtitle2" fontWeight={600}>Podela troškova (opciono)</Typography>
        <TextField
          type="number"
          label="Cena po igraču (RSD)"
          value={pricePerPlayer}
          inputProps={{ min: 0, step: 50 }}
          fullWidth
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { setPricePerPlayer(""); return; }
            const value = Number(raw);
            if (!Number.isNaN(value) && value >= 0) setPricePerPlayer(value);
          }}
          helperText="Npr. 400 — prikazuje se u detaljima meča"
          placeholder="npr. 400"
        />
      </>
    );
  }

  function renderStep1Combined() {
    return (
      <Stack spacing={3}>
        {isInformal ? renderStep1Informal() : renderStep1Formal()}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Stack spacing={2}>
            {renderPlayersAndPriceFields()}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  function renderStep0Informal() {
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

        <TextField
          select
          label="Igra / sport"
          value={sport}
          onChange={(e) => handleSportChange(e.target.value)}
          fullWidth
          required
          disabled={sportOptions.length === 0}
          helperText={
            sportOptions.length === 0
              ? "Nemaš odabrane igre na profilu"
              : "Samo igre koje si odabrao na profilu"
          }
        >
          {sportOptions.map((s) => (
            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
          ))}
        </TextField>

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
              border: "2px solid", borderColor: informalMarkerPosition ? "warning.main" : "divider",
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

  function renderStep0Formal() {
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>Izaberite teren</Typography>
              {userLocation && (
                <Typography variant="caption" color="text.secondary">
                  Sortirano po udaljenosti od tvoje lokacije
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleOpenAddField}
              variant="outlined"
              sx={{ borderRadius: 2, alignSelf: { xs: "stretch", sm: "auto" } }}
            >
              Dodaj teren
            </Button>
          </Stack>
          {locationError && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{locationError}</Alert>
          )}
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1, maxHeight: 400, overflow: "auto" }}>
            <Stack spacing={1}>
              {fieldsNearUser.map((field) => {
                const distanceKm =
                  userLocation && field.lat != null && field.lng != null
                    ? getDistance(userLocation[0], userLocation[1], field.lat, field.lng)
                    : null;
                return (
                <Card
                  key={field._id}
                  elevation={0}
                  onClick={() => setFieldId(field._id)}
                  sx={{
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: fieldId === field._id ? "primary.main" : "transparent",
                    bgcolor: fieldId === field._id ? "primary.main" : "background.paper",
                    color: fieldId === field._id ? "primary.contrastText" : "text.primary",
                    borderRadius: 2,
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                >
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: fieldId === field._id ? "rgba(255,255,255,0.2)" : "action.hover", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <LocationOnIcon />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>{field.name}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                          {(field.sports || [field.sport]).filter(Boolean).map((s) => (
                            <Chip key={s} label={getGameTypeName(s!)} size="small" sx={{ bgcolor: fieldId === field._id ? "rgba(255,255,255,0.2)" : "action.hover", color: "inherit", fontWeight: 500 }} />
                          ))}
                          {distanceKm != null && (
                            <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 600 }}>
                              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                            </Typography>
                          )}
                          {field.price && field.price > 0 && (
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>{field.price} EUR</Typography>
                          )}
                        </Stack>
                      </Box>
                      {fieldId === field._id && <CheckCircleIcon sx={{ color: "white" }} />}
                    </Stack>
                  </CardContent>
                </Card>
              );
              })}
            </Stack>
          </Paper>
        </Box>
      </Stack>
    );
  }

  function renderStep1Informal() {
    const minAllowedDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const minDate = formatLocalDateTime(minAllowedDate).split("T")[0];
    const selectedInformalDate = selectedDateTime ? selectedDateTime.split("T")[0] : "";
    const selectedInformalTime = selectedDateTime ? selectedDateTime.split("T")[1] : "";
    const availableInformalHours = getAvailableInformalHours(selectedInformalDate);

    const handleInformalDateChange = (date: string) => {
      const availableHours = getAvailableInformalHours(date);
      const nextTime = availableHours.includes(selectedInformalTime)
        ? selectedInformalTime
        : (availableHours[0] || "");
      setSelectedDateTime(nextTime ? `${date}T${nextTime}` : "");
    };

    const handleInformalTimeChange = (time: string) => {
      if (!selectedInformalDate) return;
      setSelectedDateTime(`${selectedInformalDate}T${time}`);
    };

    return (
      <Stack spacing={3}>
        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Za privatne mečeve ti biraš kada se prijave zatvaraju (koliko sati pre meča).
        </Alert>
        <TextField
          select
          fullWidth
          label="Rok za prijavu (sati pre meča)"
          value={informalRegistrationDeadlineHours}
          onChange={(e) => setInformalRegistrationDeadlineHours(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 6, 8, 12, 24, 36, 48].map((h) => (
            <MenuItem key={h} value={h}>{h} {h === 1 ? 'sat' : 'sati'} pre</MenuItem>
          ))}
        </TextField>
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Datum i vreme meča
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date"
              label="Datum"
              value={selectedInformalDate}
              onChange={(e) => handleInformalDateChange(e.target.value)}
              inputProps={{ min: minDate }}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
            <TextField
              select
              label="Vreme"
              value={selectedInformalTime}
              onChange={(e) => handleInformalTimeChange(e.target.value)}
              required
              fullWidth
              disabled={!selectedInformalDate}
              helperText={selectedInformalDate ? "Možete izabrati samo pun sat" : "Prvo odaberite datum"}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            >
              {availableInformalHours.map((time) => (
                <MenuItem key={time} value={time}>{time}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Box>
        {selectedDateTime && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Odabran termin: {new Date(selectedDateTime).toLocaleString("sr-RS", {
                weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rok za prijavu: {(() => {
                const d = new Date(selectedDateTime);
                d.setHours(d.getHours() - informalRegistrationDeadlineHours);
                return d.toLocaleString("sr-RS", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
              })()} ({informalRegistrationDeadlineHours} {informalRegistrationDeadlineHours === 1 ? 'sat' : 'sati'} pre meča)
            </Typography>
          </Alert>
        )}
      </Stack>
    );
  }

  function renderStep1Formal() {
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        {selectedField && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocationOnIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>{selectedField.name}</Typography>
            </Stack>
          </Paper>
        )}
        {selectedField && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Igra / sport za meč
            </Typography>
            {allowedFieldSports.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Teren ne podržava tvoje omiljene igre. Izaberi drugi teren ili ažuriraj profil.
              </Alert>
            ) : (
              <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  {allowedFieldSports.map((s) => (
                    <Chip
                      key={s}
                      label={getGameTypeName(s)}
                      onClick={() => handleSportChange(s)}
                      color={sport === s ? "primary" : "default"}
                      variant={sport === s ? "filled" : "outlined"}
                      sx={{ cursor: "pointer", fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>
        )}
        {loadingSlots ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>Učitavanje dostupnih termina...</Alert>
        ) : availableDates.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Odaberite datum i vreme</Typography>
            <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, maxHeight: 400, overflow: "auto" }}>
              <Stack spacing={0} divider={<Divider />}>
                {availableDates.map((date) => {
                  const dateSlots = slotsByDate[date];
                  const isSelectedDate = selectedDate === date;
                  return (
                    <Box key={date} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: isSelectedDate ? "primary.main" : "text.primary" }}>
                        {new Date(date).toLocaleDateString("sr-RS", { weekday: "long", day: "numeric", month: "long" })}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {dateSlots.map((slot) => (
                          <Chip
                            key={slot.datetime}
                            label={slot.time}
                            onClick={() => { setSelectedDate(date); setSelectedDateTime(slot.datetime); }}
                            color={selectedDateTime === slot.datetime ? "primary" : "default"}
                            variant={selectedDateTime === slot.datetime ? "filled" : "outlined"}
                            sx={{ cursor: "pointer", fontWeight: 600 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
            {selectedDateTime && selectedField && (
              <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }} icon={<CheckCircleIcon />}>
                <Typography variant="body2" fontWeight={600}>
                  Odabran termin: {availableTimeSlots.find((s) => s.datetime === selectedDateTime)?.display}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rok za prijavu: {(() => {
                    const matchDate = new Date(selectedDateTime);
                    const deadlineHours = selectedField.registrationDeadlineHours ?? 0;
                    let deadline = new Date(matchDate.getTime() - deadlineHours * 60 * 60 * 1000);
                    const now = new Date();
                    const minLead = new Date(matchDate.getTime() - 30 * 60 * 1000);
                    let note =
                      deadlineHours === 0
                        ? "do početka meča"
                        : `${deadlineHours} sati pre meča`;
                    if (deadline.getTime() < now.getTime()) {
                      deadline = minLead;
                      note = "prilagođeno (meč je ranije od standardnog roka terena)";
                    }
                    return `${deadline.toLocaleString("sr-RS", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${note}`;
                  })()}
                </Typography>
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Nema dostupnih termina za ovaj teren u narednih 30 dana. Proverite radno vreme terena.
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2, color: "text.secondary" }}>
          Nazad
        </Button>
        <Typography variant="h4" fontWeight={700}>Kreiraj meč</Typography>
        <Typography variant="body1" color="text.secondary">Pronađite igrače i organizujte meč</Typography>
      </Box>

      {preferredSports.length === 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate("/profil")}>
              Profil
            </Button>
          }
        >
          Nemaš odabrane omiljene igre. Dodaj ih na profilu da bi mogao da kreiraš meč.
        </Alert>
      )}

      {/* Informal mode toggle */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: "1px solid", borderColor: isInformal ? "warning.main" : "divider", bgcolor: isInformal ? "warning.light" : "background.paper" }}>
        <FormControlLabel
          control={
            <Switch
              checked={isInformal}
              onChange={(e) => handleModeToggle(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Stack>
              <Typography variant="subtitle2" fontWeight={600}>
                Igraj na sopstvenom terenu
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isInformal
                  ? "Slobodan meč — bez rezervacije terena, bez odobrenja"
                  : "Uključi za meč na privatnoj lokaciji (dvorište, park, itd.)"}
              </Typography>
            </Stack>
          }
        />
      </Paper>

      {/* Clone last match preset */}
      {lastPreset && !presetApplied && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "primary.light",
            bgcolor: "action.hover",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Kloniraj prošli meč
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {(getGameTypeName(lastPreset.sport))}
                {" · "}
                {lastPreset.isInformal
                  ? (lastPreset.informalLocationName || "Privatni teren")
                  : (lastPreset.fieldName || "Teren")}
                {" · "}
                {lastPreset.minPlayers}
                {lastPreset.maxPlayers !== "" ? `–${lastPreset.maxPlayers}` : "+"} igrača
              </Typography>
            </Stack>
            <Button
              variant="contained"
              startIcon={<ContentCopyIcon />}
              onClick={applyLastPreset}
              sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
            >
              Primeni postavke
            </Button>
          </Stack>
        </Paper>
      )}

      {presetApplied && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setPresetApplied(false)}>
          Postavke prethodnog meča su primenjene — samo odaberi novi termin.
        </Alert>
      )}

      {/* Stepper */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel={!isMobile}
        orientation={isMobile ? "vertical" : "horizontal"}
        sx={{ mb: 4 }}
      >
        {steps.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Box sx={{ mb: 4 }}>{renderStepContent(activeStep)}</Box>

      {/* Navigation */}
      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
      >
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBackIcon />}
          sx={{ px: 3, width: { xs: "100%", sm: "auto" } }}
        >
          Nazad
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          endIcon={activeStep === steps.length - 1 ? null : <ArrowForwardIcon />}
          sx={{ px: 3, width: { xs: "100%", sm: "auto" } }}
        >
          {activeStep === steps.length - 1 ? "Kreiraj meč" : "Dalje"}
        </Button>
      </Stack>

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
          <Typography variant="h5" fontWeight={700}>Dodaj novi teren</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <TextField label="Naziv terena" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} required fullWidth />
            <TextField select label="Igra / sport" value={newFieldSport} onChange={(e) => setNewFieldSport(e.target.value)} required fullWidth>
              {getSportSelectOptions().map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
            <TextField type="number" label="Cena (EUR) - opciono" value={newFieldPrice} onChange={(e) => setNewFieldPrice(parseFloat(e.target.value) || 0)} fullWidth inputProps={{ min: 0 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Lokacija terena</Typography>
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
          <Button onClick={handleAddField} variant="contained" disabled={!newFieldLat || !newFieldLng || !newFieldName} sx={{ borderRadius: 3, px: 3, width: { xs: "100%", sm: "auto" } }}>Dodaj teren</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
