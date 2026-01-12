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
 * OneSignal SDK v16 uses OneSignalDeferred array for async loading
 */
export async function initOneSignal(): Promise<boolean> {
  const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

  if (!ONESIGNAL_APP_ID) {
    console.warn('⚠️  OneSignal App ID not configured');
    return false;
  }

  try {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if already loaded
    if ((window as any).OneSignal) {
      OneSignal = (window as any).OneSignal;
      console.log('✅ OneSignal SDK already loaded');
      return true;
    }

    // Initialize OneSignalDeferred array if it doesn't exist
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="OneSignalSDK"]');
    if (existingScript) {
      // Script is loading, wait for it using OneSignalDeferred
      return new Promise((resolve) => {
        (window as any).OneSignalDeferred.push(async function(OneSignalInstance: any) {
          OneSignal = OneSignalInstance;
          console.log('✅ OneSignal SDK loaded (was loading)');
          resolve(true);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!OneSignal) {
            console.error('❌ OneSignal SDK loading timeout');
            resolve(false);
          }
        }, 10000);
      });
    }

    // Load OneSignal SDK dynamically
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true; // Use defer instead of async for better compatibility
      
      // Use OneSignalDeferred to wait for SDK
      (window as any).OneSignalDeferred.push(async function(OneSignalInstance: any) {
        OneSignal = OneSignalInstance;
        console.log('✅ OneSignal SDK loaded and available');
        resolve(true);
      });

      script.onerror = () => {
        console.error('❌ Failed to load OneSignal SDK script');
        resolve(false);
      };
      
      document.head.appendChild(script);

      // Fallback: also check window.OneSignal directly after a delay
      setTimeout(() => {
        if (!OneSignal && (window as any).OneSignal) {
          OneSignal = (window as any).OneSignal;
          console.log('✅ OneSignal SDK loaded (fallback check)');
          resolve(true);
        }
      }, 2000);
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
  // Ensure SDK is loaded
  if (!OneSignal) {
    const initialized = await initOneSignal();
    if (!initialized || !OneSignal) {
      throw new Error('OneSignal SDK not loaded');
    }
  }

  try {
    // Get current user ID from backend first
    const profileRes = await api.get('/api/players/profile');
    const userId = profileRes.data._id;

    const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (!ONESIGNAL_APP_ID) {
      throw new Error('OneSignal App ID not configured');
    }

    // Wait a bit for SDK to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize OneSignal (simpler approach - just send subscription to backend)
    // OneSignal SDK v16 will automatically handle subscription when user grants permission
    // We just need to save the external user ID mapping on backend
    
    // Send subscription to backend with userId as external ID
    await api.post('/api/players/push-subscription', {
      provider: 'onesignal',
      subscription: {
        playerExternalId: userId.toString()
      }
    });

    console.log('✅ OneSignal subscription successful');
    return userId.toString();
  } catch (error: any) {
    console.error('❌ Error subscribing to OneSignal:', error);
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
