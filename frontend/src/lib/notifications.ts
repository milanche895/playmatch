// Frontend Push Notification Service
// Supports OneSignal and FCM with feature flag

import api from './api';

const PUSH_PROVIDER = import.meta.env.VITE_PUSH_NOTIFICATION_PROVIDER || 'onesignal';

// OneSignal SDK
let OneSignal: any = null;

// Firebase SDK
let messaging: any = null;

/**
 * Initialize OneSignal SDK
 */
export async function initOneSignal(): Promise<boolean> {
  const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

  if (!ONESIGNAL_APP_ID) {
    console.warn('⚠️  OneSignal App ID not configured');
    return false;
  }

  try {
    // Load OneSignal Web SDK via script tag (recommended approach)
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      // Check if already loaded and initialized
      if ((window as any).OneSignal) {
        OneSignal = (window as any).OneSignal;
        // Check if already initialized
        if (OneSignal.User && OneSignal.User.PushSubscription) {
          console.log('✅ OneSignal already initialized');
          resolve(true);
          return;
        }
        
        // Initialize if not already initialized
        OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true
        }).then(() => {
          console.log('✅ OneSignal initialized (already loaded)');
          resolve(true);
        }).catch((err: any) => {
          console.error('❌ Error initializing OneSignal:', err);
          resolve(false);
        });
        return;
      }

      // Load OneSignal SDK dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.async = true;
      script.onload = () => {
        OneSignal = (window as any).OneSignal;
        if (!OneSignal) {
          console.error('❌ OneSignal SDK loaded but window.OneSignal is not available');
          resolve(false);
          return;
        }
        
        OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true
        }).then(() => {
          console.log('✅ OneSignal initialized');
          resolve(true);
        }).catch((err: any) => {
          console.error('❌ Error initializing OneSignal:', err);
          resolve(false);
        });
      };
      script.onerror = () => {
        console.error('❌ Failed to load OneSignal SDK');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error('❌ Error initializing OneSignal:', error);
    return false;
  }
}

/**
 * Initialize Firebase Cloud Messaging
 */
export async function initFCM(): Promise<boolean> {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('⚠️  Firebase config not set');
    return false;
  }

  try {
    // Dynamic import with error handling
    let firebaseApp, firebaseMessaging;
    try {
      firebaseApp = await import('firebase/app');
      firebaseMessaging = await import('firebase/messaging');
    } catch (importError) {
      console.error('❌ Failed to import Firebase modules. Make sure firebase package is installed:', importError);
      return false;
    }

    const { initializeApp, getApps } = firebaseApp;
    const { getMessaging } = firebaseMessaging;

    // Check if messaging is supported (if available)
    if ('isSupported' in firebaseMessaging && typeof (firebaseMessaging as any).isSupported === 'function') {
      try {
        const isSupported = (firebaseMessaging as any).isSupported;
        const supported = await isSupported();
        if (!supported) {
          console.warn('⚠️  Firebase Messaging not supported in this browser');
          return false;
        }
      } catch (supportError) {
        // If isSupported check fails, continue anyway (might work)
        console.warn('⚠️  Could not check Firebase Messaging support:', supportError);
      }
    }

    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    messaging = getMessaging(app);
    console.log('✅ Firebase Messaging initialized');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    return false;
  }
}

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
 * Subscribe to OneSignal notifications
 */
export async function subscribeOneSignal(): Promise<string | null> {
  // Always re-initialize to ensure SDK is ready
  const initialized = await initOneSignal();
  if (!initialized || !OneSignal) {
    throw new Error('OneSignal not initialized');
  }

  try {
    // Wait a bit to ensure SDK is fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get current user ID from backend
    const profileRes = await api.get('/api/players/profile');
    const userId = profileRes.data._id;

    // OneSignal SDK v16 uses login() method instead of setExternalUserId
    // Check for different API versions
    if (typeof OneSignal.login === 'function') {
      // New v16+ API
      await OneSignal.login(userId.toString());
    } else if (typeof OneSignal.setExternalUserId === 'function') {
      // Older API
      await OneSignal.setExternalUserId(userId.toString());
    } else if (OneSignal.User && typeof OneSignal.User.setExternalId === 'function') {
      // Alternative v16 API
      await OneSignal.User.setExternalId(userId.toString());
    } else {
      console.warn('⚠️  login/setExternalUserId methods not available, continuing without setting external ID');
    }

    // Opt in to push notifications (if needed)
    if (OneSignal.User && OneSignal.User.PushSubscription) {
      if (typeof OneSignal.User.PushSubscription.optIn === 'function') {
        await OneSignal.User.PushSubscription.optIn();
      }
    }

    // Get OneSignal player ID
    let playerId: string | null = null;
    if (typeof OneSignal.getPlayerId === 'function') {
      playerId = await OneSignal.getPlayerId();
    } else if (OneSignal.User && OneSignal.User.PushSubscription) {
      if (typeof OneSignal.User.PushSubscription.getId === 'function') {
        playerId = await OneSignal.User.PushSubscription.getId();
      }
    }

    // If player ID not available immediately, wait a bit
    if (!playerId) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (typeof OneSignal.getPlayerId === 'function') {
        playerId = await OneSignal.getPlayerId();
      } else if (OneSignal.User && OneSignal.User.PushSubscription && typeof OneSignal.User.PushSubscription.getId === 'function') {
        playerId = await OneSignal.User.PushSubscription.getId();
      }
    }

    // Send subscription to backend
    await api.post('/api/players/push-subscription', {
      provider: 'onesignal',
      subscription: {
        playerExternalId: userId.toString() // Use our userId as external ID
      }
    });

    console.log('✅ OneSignal subscription successful');
    return playerId || userId.toString();
  } catch (error: any) {
    console.error('❌ Error subscribing to OneSignal:', error);
    console.error('OneSignal object:', OneSignal);
    throw error;
  }
}

/**
 * Subscribe to FCM notifications
 */
export async function subscribeFCM(): Promise<string | null> {
  if (!messaging) {
    const initialized = await initFCM();
    if (!initialized) {
      throw new Error('FCM not initialized');
    }
  }

  try {
    const firebaseMessaging = await import('firebase/messaging');
    const { getToken } = firebaseMessaging;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error('Firebase VAPID key not configured');
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      throw new Error('No FCM token available');
    }

    // Get device info
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    };

    // Send subscription to backend
    await api.post('/api/players/push-subscription', {
      provider: 'fcm',
      subscription: {
        fcmToken: token,
        deviceInfo
      }
    });

    console.log('✅ FCM subscription successful');
    return token;
  } catch (error: any) {
    console.error('❌ Error subscribing to FCM:', error);
    throw error;
  }
}

/**
 * Subscribe to push notifications (uses configured provider)
 */
export async function subscribeToPushNotifications(): Promise<string | null> {
  // First request browser permission
  const permission = await requestNotificationPermission();
  
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  if (PUSH_PROVIDER === 'onesignal') {
    return await subscribeOneSignal();
  } else if (PUSH_PROVIDER === 'fcm') {
    return await subscribeFCM();
  } else {
    throw new Error(`Unknown push notification provider: ${PUSH_PROVIDER}`);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(provider?: string, fcmToken?: string): Promise<void> {
  const providerToUse = provider || PUSH_PROVIDER;
  
  try {
    await api.delete('/api/players/push-subscription', {
      data: {
        provider: providerToUse,
        fcmToken
      }
    });

    if (providerToUse === 'onesignal' && OneSignal) {
      // Logout (this clears external user ID in v16+)
      if (typeof OneSignal.logout === 'function') {
        await OneSignal.logout();
      } else if (typeof OneSignal.setExternalUserId === 'function') {
        // Older API
        await OneSignal.setExternalUserId(null);
        if (typeof OneSignal.logout === 'function') {
          await OneSignal.logout();
        }
      } else if (OneSignal.User && typeof OneSignal.User.logout === 'function') {
        await OneSignal.User.logout();
      }
    }

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
  provider: string | null;
  activeProvider: string;
  enabled: boolean;
  permission: NotificationPermission;
}> {
  const permission = Notification.permission;

  try {
    const res = await api.get('/api/players/push-subscription/status');
    return {
      ...res.data,
      permission
    };
  } catch (error: any) {
    console.error('❌ Error getting notification status:', error);
    return {
      provider: null,
      activeProvider: PUSH_PROVIDER,
      enabled: false,
      permission
    };
  }
}

/**
 * Initialize push notification service (called on app startup)
 */
export async function initPushNotifications(): Promise<void> {
  if (PUSH_PROVIDER === 'onesignal') {
    await initOneSignal();
    
    // Set up message handler
    if (OneSignal && typeof window !== 'undefined') {
      OneSignal.on('notificationDisplay', (event: any) => {
        console.log('OneSignal notification displayed:', event);
      });
    }
  } else if (PUSH_PROVIDER === 'fcm') {
    await initFCM();
    
    // Set up foreground message handler
    if (messaging) {
      const firebaseMessaging = await import('firebase/messaging');
      const { onMessage } = firebaseMessaging;
      onMessage(messaging, (payload: any) => {
        console.log('FCM message received in foreground:', payload);
        
        // Show notification manually if needed
        if (payload.notification) {
          new Notification(payload.notification.title || 'PlayMatch', {
            body: payload.notification.body,
            icon: payload.notification.icon || '/icons/icon-192.png',
            data: payload.data
          });
        }
      });
    }
  }
}

export { PUSH_PROVIDER };
