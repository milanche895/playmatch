import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  IconButton,
  Tooltip,
  Divider,
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
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PeopleIcon from "@mui/icons-material/People";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MyLocationIcon from "@mui/icons-material/MyLocation";

// Fix Leaflet icon issue
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15);
  }, [map, position]);
  return null;
}

type AvailableTimeSlot = {
  date: string;
  time: string;
  datetime: string;
  display: string;
};

const steps = ['Izaberi teren', 'Odaberi termin', 'Broj igrača'];

export default function CreateMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const query = useQuery();
  const [activeStep, setActiveStep] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [fieldId, setFieldId] = useState<string>(query.get("fieldId") || "");
  const [sport, setSport] = useState<string>("football");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [minPlayers, setMinPlayers] = useState<number>(10);
  const [maxPlayers, setMaxPlayers] = useState<number | "">("");

  // Add Field Dialog State
  const [openAddField, setOpenAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldSport, setNewFieldSport] = useState("football");
  const [newFieldLat, setNewFieldLat] = useState("");
  const [newFieldLng, setNewFieldLng] = useState("");
  const [newFieldPrice, setNewFieldPrice] = useState<number>(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>([44.7866, 20.4489]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function roundToFullHour(dateTimeString: string): string {
    if (!dateTimeString) return dateTimeString;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeString)) {
      return dateTimeString.replace(/:\d{2}$/, ":00");
    }
    const d = new Date(dateTimeString);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function loadFields() {
    api.get("/api/fields").then((res) => setFields(res.data));
  }

  useEffect(() => {
    loadFields();
  }, []);

  useEffect(() => {
    const dateTimeParam = query.get("dateTime");
    if (dateTimeParam) {
      try {
        const parsedDateTime = roundToFullHour(dateTimeParam);
        setSelectedDateTime(parsedDateTime);
        const datePart = parsedDateTime.split("T")[0];
        setSelectedDate(datePart);
      } catch (err) {
        console.error("Invalid dateTime parameter:", err);
      }
    }

    if (fieldId) {
      loadFieldDetailsAndSlots();
    } else {
      setSelectedField(null);
      setAvailableTimeSlots([]);
      if (!dateTimeParam) {
        setSelectedDateTime("");
      }
    }
  }, [fieldId, query]);

  async function loadFieldDetailsAndSlots() {
    if (!fieldId) return;
    try {
      setLoadingSlots(true);
      const fieldRes = await api.get<Field>(`/api/fields/${fieldId}`);
      const field = fieldRes.data;
      setSelectedField(field);
      
      // Set sport - preserve current selection if it's still available for this field
      const availableSports = field.sports || (field.sport ? [field.sport] : []);
      if (availableSports.length > 0) {
        // If current sport is not in available sports, use first available
        if (!availableSports.includes(sport)) {
          setSport(availableSports[0]);
        }
        // Otherwise keep current sport selection
      }

      const matchesRes = await api.get<Match[]>("/api/matches");
      const fieldMatches = matchesRes.data.filter(
        (m) =>
          m.fieldId._id === fieldId ||
          (typeof m.fieldId === "object" && m.fieldId._id === fieldId) ||
          (typeof m.fieldId === "string" && m.fieldId === fieldId)
      );

      const slots = generateAvailableTimeSlots(field, fieldMatches);
      setAvailableTimeSlots(slots);

      const dateTimeParam = query.get("dateTime");
      if (!dateTimeParam) {
        if (slots.length > 0) {
          const firstSlot = slots[0];
          setSelectedDate(firstSlot.date);
          setSelectedDateTime(firstSlot.datetime);
        } else {
          setSelectedDate("");
          if (!selectedDateTime) {
            setSelectedDateTime("");
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load field details:", err);
      setError("Neuspešno učitavanje detalja terena");
    } finally {
      setLoadingSlots(false);
    }
  }

  function formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
        matchDate.setMinutes(0);
        matchDate.setSeconds(0);
        matchDate.setMilliseconds(0);
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

        const dateStr = slotDate.toLocaleDateString("sr-RS", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const timeStr = `${hour.toString().padStart(2, "0")}:00`;
        const dateOnly = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, "0")}-${String(slotDate.getDate()).padStart(2, "0")}`;

        slots.push({ date: dateOnly, time: timeStr, datetime, display: `${dateStr} ${timeStr}` });
      }
    }
    return slots.sort((a, b) => a.datetime.localeCompare(b.datetime));
  }

  function getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.latitude && position.coords.longitude) {
            const location: [number, number] = [position.coords.latitude, position.coords.longitude];
            setMapCenter(location);
            setMarkerPosition(location);
            setNewFieldLat(location[0].toFixed(6));
            setNewFieldLng(location[1].toFixed(6));
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Morate biti ulogovani da biste kreirali meč");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }
    if (!fieldId) {
      setError("Molimo odaberite teren");
      return;
    }
    if (!selectedDateTime) {
      setError("Molimo odaberite termin");
      return;
    }

    try {
      const dateTimeToSend = roundToFullHour(selectedDateTime);
      const res = await api.post<Match>("/api/matches", {
        sport,
        fieldId,
        dateTime: dateTimeToSend,
        minPlayers,
        maxPlayers: maxPlayers === "" ? undefined : maxPlayers,
      });
      navigate(`/matches/${res.data._id}`);
    } catch (err: any) {
      console.error("Error creating match:", err);
      if (err.response?.status === 401) {
        setError("Niste autentifikovani. Molimo ulogujte se ponovo.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(err.response?.data?.message || "Neuspešno kreiranje meča");
      }
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setNewFieldLat(lat.toFixed(6));
    setNewFieldLng(lng.toFixed(6));
    setMarkerPosition([lat, lng]);
  }

  function handleDialogClose() {
    setOpenAddField(false);
    setError(null);
    setNewFieldName("");
    setNewFieldLat("");
    setNewFieldLng("");
    setNewFieldPrice(0);
    setMarkerPosition(null);
    setMapCenter([44.7866, 20.4489]);
  }

  function handleOpenAddField() {
    getUserLocation();
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
      });
      setFields([...fields, res.data]);
      setFieldId(res.data._id);
      handleDialogClose();
    } catch (err) {
      setError("Neuspešno dodavanje terena");
    }
  }

  const handleNext = () => {
    if (activeStep === 0 && !fieldId) {
      setError("Molimo odaberite teren");
      return;
    }
    if (activeStep === 1 && !selectedDateTime) {
      setError("Molimo odaberite termin");
      return;
    }
    setError(null);
    if (activeStep === steps.length - 1) {
      onSubmit(new Event('submit') as any);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  // Group time slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailableTimeSlot[]> = {};
    availableTimeSlots.forEach(slot => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  }, [availableTimeSlots]);

  // Filter dates to only show next 5 days from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fiveDaysLater = new Date(today);
  fiveDaysLater.setDate(today.getDate() + 5);

  const availableDates = Object.keys(slotsByDate)
    .filter(dateStr => {
      const date = new Date(dateStr);
      return date >= today && date <= fiveDaysLater;
    })
    .sort();

  // Step content
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                Izaberite teren
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  p: 1,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                <Stack spacing={1}>
                  {fields.map((field) => (
                    <Card
                      key={field._id}
                      elevation={0}
                      onClick={() => setFieldId(field._id)}
                      sx={{
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: fieldId === field._id ? 'primary.main' : 'transparent',
                        bgcolor: fieldId === field._id ? 'primary.main' : 'background.paper',
                        color: fieldId === field._id ? 'primary.contrastText' : 'text.primary',
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              bgcolor: fieldId === field._id ? 'rgba(255,255,255,0.2)' : 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <LocationOnIcon />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {field.name}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
                              {(field.sports || [field.sport]).filter(Boolean).map((s) => (
                                <Chip
                                  key={s}
                                  label={s}
                                  size="small"
                                  sx={{
                                    bgcolor: fieldId === field._id ? 'rgba(255,255,255,0.2)' : 'action.hover',
                                    color: 'inherit',
                                    fontWeight: 500,
                                  }}
                                />
                              ))}
                              {field.price && field.price > 0 && (
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                  {field.price} EUR
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                          {fieldId === field._id && (
                            <CheckCircleIcon sx={{ color: 'white' }} />
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            
            {selectedField && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedField.name}
                  </Typography>
                </Stack>
              </Paper>
            )}

            {/* Sport Selection - only show if field has multiple sports */}
            {selectedField && (selectedField.sports || []).length > 1 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                  Odaberite sport za meč
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    p: 2,
                  }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                    {(selectedField.sports || []).map((s) => (
                      <Chip
                        key={s}
                        label={s.charAt(0).toUpperCase() + s.slice(1)}
                        onClick={() => setSport(s)}
                        color={sport === s ? 'primary' : 'default'}
                        variant={sport === s ? 'filled' : 'outlined'}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: sport === s ? 'primary.main' : 'action.hover',
                          },
                        }}
                      />
                    ))}
                  </Stack>
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Odabrani sport: <strong>{sport.charAt(0).toUpperCase() + sport.slice(1)}</strong>
                </Typography>
              </Box>
            )}

            {loadingSlots ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Učitavanje dostupnih termina...
              </Alert>
            ) : availableDates.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                  Odaberite datum i vreme
                </Typography>
                
                <Paper
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  <Stack spacing={0} divider={<Divider />}>
                    {availableDates.map((date) => {
                      const dateSlots = slotsByDate[date];
                      const dateObj = new Date(date);
                      const isSelectedDate = selectedDate === date;
                      
                      return (
                        <Box key={date} sx={{ p: 2 }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1.5, color: isSelectedDate ? 'primary.main' : 'text.primary' }}
                          >
                            {dateObj.toLocaleDateString('sr-RS', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {dateSlots.map((slot) => (
                              <Chip
                                key={slot.datetime}
                                label={slot.time}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setSelectedDateTime(slot.datetime);
                                }}
                                color={selectedDateTime === slot.datetime ? 'primary' : 'default'}
                                variant={selectedDateTime === slot.datetime ? 'filled' : 'outlined'}
                                sx={{
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  '&:hover': {
                                    bgcolor: selectedDateTime === slot.datetime ? 'primary.main' : 'action.hover',
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>

                {selectedDateTime && selectedField && (
                  <Alert
                    severity="success"
                    sx={{ mt: 2, borderRadius: 2 }}
                    icon={<CheckCircleIcon />}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      Odabran termin: {availableTimeSlots.find(s => s.datetime === selectedDateTime)?.display}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rok za prijavu: {(() => {
                        const matchDate = new Date(selectedDateTime);
                        const deadlineHours = selectedField.registrationDeadlineHours ?? 24;
                        const deadline = new Date(matchDate);
                        deadline.setHours(deadline.getHours() - deadlineHours);
                        return deadline.toLocaleString('sr-RS', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      })()} ({selectedField.registrationDeadlineHours ?? 24} sati pre meča)
                    </Typography>
                  </Alert>
                )}
              </Box>
            ) : (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Nema dostupnih termina za ovaj teren u narednih 30 dana.
                Proverite radno vreme terena.
              </Alert>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
                Pregled meča
              </Typography>
              
              <Stack spacing={2} sx={{ mb: 4 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <LocationOnIcon />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Teren
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {selectedField?.name}
                    </Typography>
                  </Box>
                </Stack>
                
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <AccessTimeIcon />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Termin
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {availableTimeSlots.find(s => s.datetime === selectedDateTime)?.display}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                Broj igrača
              </Typography>
              
              <Stack spacing={3}>
                <TextField
                  type="number"
                  label="Minimalni broj igrača"
                  value={minPlayers}
                  inputProps={{ min: 1 }}
                  required
                  fullWidth
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setMinPlayers(1);
                      return;
                    }
                    const value = Number(raw);
                    if (value >= 1) {
                      setMinPlayers(value);
                      if (typeof maxPlayers === "number" && maxPlayers < value) {
                        setMaxPlayers("");
                      }
                    }
                  }}
                />

                <TextField
                  type="number"
                  label="Maksimalni broj igrača (opciono)"
                  value={maxPlayers}
                  inputProps={{ min: minPlayers }}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : parseInt(e.target.value);
                    if (value === "" || (!isNaN(value as number) && (value as number) >= minPlayers)) {
                      setMaxPlayers(value);
                    }
                  }}
                  helperText={maxPlayers === "" ? "Ostavite prazno ako nema maksimuma" : `Maksimum: ${maxPlayers} igrača`}
                  fullWidth
                />
              </Stack>
            </Paper>
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Nazad
        </Button>
        <Typography variant="h4" fontWeight={700}>
          Kreiraj meč
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Pronađite igrače i organizujte meč
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Box sx={{ mb: 4 }}>
        {renderStepContent(activeStep)}
      </Box>

      {/* Navigation Buttons */}
      <Stack direction="row" spacing={2} justifyContent="space-between">
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBackIcon />}
          sx={{ px: 3 }}
        >
          Nazad
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          endIcon={activeStep === steps.length - 1 ? null : <ArrowForwardIcon />}
          sx={{ px: 3 }}
        >
          {activeStep === steps.length - 1 ? 'Kreiraj meč' : 'Dalje'}
        </Button>
      </Stack>

      {/* Add Field Dialog */}
      <Dialog
        open={openAddField}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle>
          <Typography variant="h5" fontWeight={700}>
            Dodaj novi teren
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            
            <TextField
              label="Naziv terena"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              required
              fullWidth
            />
            
            <TextField
              select
              label="Sport"
              value={newFieldSport}
              onChange={(e) => setNewFieldSport(e.target.value)}
              required
              fullWidth
            >
              {["football", "basketball", "tennis"].map((s) => (
                <MenuItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              type="number"
              label="Cena (EUR) - opciono"
              value={newFieldPrice}
              onChange={(e) => setNewFieldPrice(parseFloat(e.target.value) || 0)}
              fullWidth
              inputProps={{ min: 0 }}
            />

            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Lokacija terena
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Kliknite na mapu da postavite lokaciju ili koristite vašu trenutnu lokaciju
              </Typography>
              
              <Button
                startIcon={<MyLocationIcon />}
                onClick={getUserLocation}
                size="small"
                sx={{ mb: 2 }}
              >
                Koristi moju lokaciju
              </Button>
              
              <Paper
                elevation={0}
                sx={{
                  height: 300,
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: markerPosition ? 'primary.main' : 'divider',
                  borderWidth: markerPosition ? 2 : 1,
                }}
              >
                <MapContainer
                  center={mapCenter}
                  zoom={markerPosition ? 15 : 13}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                  key={`${mapCenter[0]}-${mapCenter[1]}`}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenter position={mapCenter} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
              </Paper>
            </Box>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Geografska širina"
                value={newFieldLat}
                InputProps={{ readOnly: true }}
                fullWidth
                helperText={!newFieldLat ? "Kliknite na mapu" : "✓ Postavljeno"}
              />
              <TextField
                label="Geografska dužina"
                value={newFieldLng}
                InputProps={{ readOnly: true }}
                fullWidth
                helperText={!newFieldLng ? "Kliknite na mapu" : "✓ Postavljeno"}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleDialogClose} variant="outlined" sx={{ borderRadius: 3, px: 3 }}>
            Otkaži
          </Button>
          <Button
            onClick={handleAddField}
            variant="contained"
            disabled={!newFieldLat || !newFieldLng || !newFieldName}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Dodaj teren
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
