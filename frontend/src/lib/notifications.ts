// Frontend PWA Push Notification Service
// Uses native browser Push API with VAPID keys

import api from './api';

/**
 * Request notification permission (user-friendly wrapper)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    throw new Error('Notification permission was previously denied. Please enable it in browser settings.');
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Get service worker registration
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser');
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration) {
    throw new Error('Service Worker is not registered');
  }

  return registration;
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
  // First request browser permission
  const permission = await requestNotificationPermission();
  
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  try {
    // Get service worker registration
    const registration = await getServiceWorkerRegistration();

    // Get VAPID public key from backend
    const vapidPublicKey = await getVapidPublicKey();

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Already subscribed, send to backend to verify
      await api.post('/api/players/push-subscription', {
        subscription: subscription.toJSON()
      });
      console.log('✅ Already subscribed to push notifications');
      return subscription.endpoint;
    }

    // Subscribe to push notifications
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    });

    // Send subscription to backend
    await api.post('/api/players/push-subscription', {
      subscription: subscription.toJSON()
    });

    console.log('✅ PWA push subscription successful');
    return subscription.endpoint;
  } catch (error: any) {
    console.error('❌ Error subscribing to push notifications:', error);
    throw error;
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
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
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