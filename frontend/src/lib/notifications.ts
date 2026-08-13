// Frontend PWA Push Notification Service
// Uses native browser Push API with VAPID keys

import api from './api';

/**
 * Request notification permission (user-friendly wrapper)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Vaš pretraživač ne podržava obaveštenja.');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    throw new Error('Dozvola za obaveštenja je već odbijena u pretraživaču. Omogućite je u podešavanjima sajta.');
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    })
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeVapidKey(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function assertPushSupportedOnThisDevice(): void {
  if (isIOSDevice() && !isStandalonePwa()) {
    throw new Error(
      'Na iPhone-u push obaveštenja rade samo iz ikone na početnom ekranu. Dodajte sajt: Deli → Dodaj na početni ekran, pa otvorite Plejko odatle.'
    );
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Ovaj pretraživač na telefonu ne podržava push obaveštenja. Otvorite sajt u Chrome-u.');
  }
}

function isPushServiceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  return name === 'AbortError' || /push service error|registration failed/i.test(message);
}

function toUserFacingPushError(error: unknown): Error {
  if (error instanceof Error && !isPushServiceError(error)) {
    return error;
  }

  return new Error(
    'Telefon nije uspeo da se prijavi na push servis. Zatvorite Chrome, otvorite Plejko ponovo i pokušajte još jednom. Ako ste na iPhone-u, koristite ikonu sa početnog ekrana.'
  );
}

function pickRootRegistration(
  registrations: readonly ServiceWorkerRegistration[]
): ServiceWorkerRegistration | undefined {
  return (
    registrations.find((registration) => {
      try {
        return new URL(registration.scope).pathname === '/';
      } catch {
        return registration.scope.endsWith('/');
      }
    }) || registrations[0]
  );
}

async function waitUntilControlling(): Promise<void> {
  if (navigator.serviceWorker.controller) return;

  await Promise.race([
    new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    }),
    delay(2000)
  ]);
}

function vapidKeyToArrayBuffer(base64String: string): ArrayBuffer {
  const bytes = urlBase64ToUint8Array(base64String);
  if (bytes.byteLength !== 65 || bytes[0] !== 0x04) {
    throw new Error('VAPID javni ključ nije ispravan. Osvežite stranicu i pokušajte ponovo.');
  }

  // Chrome Android rejects a Uint8Array view; it needs a standalone 65-byte buffer.
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function subscribeWithRetry(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription> {
  const keyBuffer = vapidKeyToArrayBuffer(vapidPublicKey);
  const keyString = vapidPublicKey.replace(/=+$/, '');

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBuffer
    });
  } catch (firstError) {
    if (!isPushServiceError(firstError)) throw firstError;

    const stale = await registration.pushManager.getSubscription();
    if (stale) {
      await stale.unsubscribe();
    }

    await delay(400);

    try {
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyString
      });
    } catch (secondError) {
      console.error('[PushDebug] subscribe retry failed', secondError);
      throw firstError;
    }
  }
}

async function waitUntilActivated(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  const worker = registration.active || registration.waiting || registration.installing;
  if (registration.active) return registration;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  if (worker && worker.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const onChange = () => {
        if (worker.state === 'activated' || worker.state === 'redundant') {
          worker.removeEventListener('statechange', onChange);
          resolve();
        }
      };
      worker.addEventListener('statechange', onChange);
      if (worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', onChange);
        resolve();
      }
    });
  }

  return withTimeout(navigator.serviceWorker.ready, 8000, 'Service worker ready timeout');
}

/**
 * Get service worker registration (dev SW is /dev-sw.js, prod is /sw.js)
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Vaš pretraživač ne podržava Service Worker. Koristite Chrome ili Edge.');
  }

  const existing = await navigator.serviceWorker.getRegistrations();
  let registration: ServiceWorkerRegistration | undefined =
    pickRootRegistration(existing) || (await navigator.serviceWorker.getRegistration('/'));

  // Dev: drop a stale /sw.js registration that cannot load ES module imports
  if (import.meta.env.DEV && registration) {
    const scriptURL =
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      '';
    if (scriptURL && !scriptURL.includes('dev-sw.js')) {
      console.warn('[PushDebug] unregistering stale SW', scriptURL);
      await registration.unregister();
      registration = undefined;
    }
  }

  if (!registration) {
    try {
      registration = await withTimeout(
        navigator.serviceWorker.ready,
        4000,
        'timeout'
      );
    } catch {
      registration = undefined;
    }
  }

  if (!registration) {
    const isDev = import.meta.env.DEV;
    const swUrl = isDev ? '/dev-sw.js?dev-sw' : '/sw.js';
    try {
      registration = await navigator.serviceWorker.register(swUrl, {
        type: isDev ? 'module' : 'classic',
        scope: '/',
      });
    } catch (err) {
      console.error('[PushDebug] SW register failed', swUrl, err);
      throw new Error('Service Worker nije spreman. Osvežite stranicu (F5) i pokušajte ponovo.');
    }
  }

  try {
    const activated = await waitUntilActivated(registration);
    await waitUntilControlling();
    return activated;
  } catch (err) {
    console.error('[PushDebug] SW activate failed', err);
    throw new Error('Service Worker nije spreman. Osvežite stranicu (F5) i pokušajte ponovo.');
  }
}

/**
 * Get VAPID public key from backend
 */
async function getVapidPublicKey(): Promise<string> {
  const res = await api.get('/api/players/vapid-public-key');
  return res.data.publicKey;
}

/**
 * Subscribe to PWA push notifications
 */
export async function subscribeToPushNotifications(): Promise<string | null> {
  assertPushSupportedOnThisDevice();

  const permission = await requestNotificationPermission();
  
  if (permission !== 'granted') {
    throw new Error('Dozvola za obaveštenja nije odobrena.');
  }

  // Android FCM often is not ready in the same tick as the permission prompt.
  await delay(350);

  try {
    const registration = await getServiceWorkerRegistration();
    const vapidPublicKey = sanitizeVapidKey(await getVapidPublicKey());

    if (!vapidPublicKey) {
      throw new Error('VAPID javni ključ nije konfigurisan.');
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await subscribeWithRetry(registration, vapidPublicKey);
    }

    await api.post('/api/players/push-subscription', {
      subscription: subscription.toJSON()
    });

    console.log('✅ PWA push subscription successful');
    return subscription.endpoint;
  } catch (error: unknown) {
    console.error('❌ Error subscribing to push notifications:', error);
    throw toUserFacingPushError(error);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    await api.delete('/api/players/push-subscription');
    console.log('✅ Unsubscribed from push notifications');
  } catch (error: any) {
    console.error('❌ Error unsubscribing:', error);
    throw error;
  }
}

/**
 * Get notification subscription status
 */
export async function getNotificationStatus(): Promise<{
  subscribed: boolean;
  enabled: boolean;
  permission: NotificationPermission;
  endpoint?: string;
}> {
  const permission = Notification.permission;

  try {
    // Check if service worker is registered
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return {
        subscribed: false,
        enabled: false,
        permission
      };
    }

    // Wait for service worker with timeout (5 seconds)
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration>((_, reject) => 
        setTimeout(() => reject(new Error('Service worker registration timeout')), 5000)
      )
    ]).catch(err => {
      console.warn('Service worker not ready:', err);
      return null;
    });

    if (!registration) {
      return {
        subscribed: false,
        enabled: false,
        permission
      };
    }

    // Get push subscription
    let subscription = null;
    try {
      subscription = await registration.pushManager.getSubscription();
    } catch (subError) {
      console.warn('Could not get push subscription:', subError);
    }

    // Get backend status
    let backendSubscribed = false;
    let backendEnabled = true;
    try {
      const res = await api.get('/api/players/push-subscription/status');
      backendSubscribed = res.data.subscribed;
      backendEnabled = res.data.enabled !== false;
    } catch (apiError) {
      console.warn('Could not get backend subscription status:', apiError);
      // Continue with local status only
    }
    
    return {
      subscribed: subscription !== null && backendSubscribed,
      enabled: backendEnabled,
      permission,
      endpoint: subscription?.endpoint
    };
  } catch (error: any) {
    console.error('❌ Error getting notification status:', error);
    return {
      subscribed: false,
      enabled: false,
      permission
    };
  }
}

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const normalized = sanitizeVapidKey(base64String);
  const padding = '='.repeat((4 - normalized.length % 4) % 4);
  const base64 = (normalized + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Initialize push notification service (called on app startup)
 * This function is kept for compatibility but doesn't do anything
 * as PWA notifications don't require external SDK initialization
 */
export async function initPushNotifications(): Promise<void> {
  // PWA push notifications don't require initialization
  // Service worker is registered by VitePWA plugin
  console.log('✅ PWA push notifications ready');
}