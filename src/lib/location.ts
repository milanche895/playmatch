import api from './api';
import { debugLog } from './debugLog';

let lastSentAt = 0;
const MIN_INTERVAL_MS = 60_000;

export function persistPlayerLocation(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) return;
  lastSentAt = now;
  debugLog('[PushDebug] persistPlayerLocation', { lat, lng });
  api.post('/api/players/location', { lat, lng }).then(() => {
    debugLog('[PushDebug] location saved');
  }).catch((err) => {
    console.warn('[PushDebug] location save failed', err.response?.status, err.response?.data || err.message);
    lastSentAt = 0;
  });
}

export function trackPlayerLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      debugLog('[PushDebug] geolocation ok', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      persistPlayerLocation(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn('[PushDebug] geolocation failed', { code: err.code, message: err.message });
    },
    {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 300000,
    }
  );
}
