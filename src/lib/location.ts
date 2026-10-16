import api from './api';
import { debugLog } from './debugLog';

let lastSentAt = 0;
const MIN_INTERVAL_MS = 60_000;
const PENDING_LOCATION_KEY = 'playmatch.pendingLocation';

let captureGeneration = 0;
let sessionActive = false;

const geoOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 300000,
};

export function persistPlayerLocation(lat: number, lng: number, force = false) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const now = Date.now();
  if (!force && now - lastSentAt < MIN_INTERVAL_MS) return;
  lastSentAt = now;
  debugLog('[PushDebug] persistPlayerLocation', { lat, lng });
  api.post('/api/players/location', { lat, lng }).then(() => {
    debugLog('[PushDebug] location saved');
  }).catch((err) => {
    console.warn('[PushDebug] location save failed', err.response?.status, err.response?.data || err.message);
    lastSentAt = 0;
  });
}

function stashPendingLocation(lat: number, lng: number) {
  try {
    sessionStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify({ lat, lng }));
  } catch {
    /* private mode / blocked storage */
  }
}

function takePendingLocation(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_LOCATION_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_LOCATION_KEY);
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    return { lat: parsed.lat as number, lng: parsed.lng as number };
  } catch {
    return null;
  }
}

/**
 * Start the browser location prompt in the same turn as the login/register click.
 * Coordinates are saved only after the player session exists.
 */
export function beginLoginLocationCapture() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  const generation = ++captureGeneration;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (generation !== captureGeneration) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      debugLog('[PushDebug] geolocation ok', { lat, lng });
      stashPendingLocation(lat, lng);
      if (sessionActive) persistPlayerLocation(lat, lng);
    },
    (err) => {
      if (generation !== captureGeneration) return;
      console.warn('[PushDebug] geolocation failed', { code: err.code, message: err.message });
    },
    geoOptions
  );
}

export function trackPlayerLocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
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
    geoOptions
  );
}

/** Send a location captured at login, or ask again once the player is signed in. */
export function syncPlayerLocation() {
  sessionActive = true;
  const pending = takePendingLocation();
  if (pending) {
    persistPlayerLocation(pending.lat, pending.lng, true);
    return;
  }
  trackPlayerLocation();
}

export function clearPlayerLocationSession() {
  sessionActive = false;
  captureGeneration += 1;
  try {
    sessionStorage.removeItem(PENDING_LOCATION_KEY);
  } catch {
    /* ignore */
  }
}
