import api from './api';

let lastSentAt = 0;
const MIN_INTERVAL_MS = 60_000;

export function persistPlayerLocation(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) return;
  lastSentAt = now;
  api.post('/api/players/location', { lat, lng }).catch(() => {
    lastSentAt = 0;
  });
}

export function trackPlayerLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      persistPlayerLocation(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      /* permission denied / unavailable — non-blocking */
    },
    {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 300000,
    }
  );
}
