// Push Notification Service - Supports OneSignal and FCM
// Feature flag: PUSH_NOTIFICATION_PROVIDER=onesignal|fcm

const PUSH_PROVIDER = process.env.PUSH_NOTIFICATION_PROVIDER || 'onesignal'; // Default to OneSignal

let onesignalClient = null;
let fcmAdmin = null;

// Initialize OneSignal client
function initOneSignal() {
  if (onesignalClient) return onesignalClient;
  
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn('⚠️  OneSignal credentials not set. OneSignal push notifications will not work.');
    console.warn('   Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in .env file');
    return null;
  }

  // OneSignal REST API client (using axios/fetch)
  onesignalClient = {
    appId: ONESIGNAL_APP_ID,
    apiKey: ONESIGNAL_REST_API_KEY,
    baseUrl: 'https://onesignal.com/api/v1'
  };

  console.log('✅ OneSignal initialized');
  return onesignalClient;
}

// Initialize Firebase Admin SDK
function initFCM() {
  if (fcmAdmin) return fcmAdmin;

  try {
    const admin = require('firebase-admin');
    
    // Initialize if not already initialized
    if (admin.apps.length === 0) {
      const serviceAccount = process.env.FIREBASE_ADMIN_CREDENTIALS 
        ? JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)
        : null;

      if (!serviceAccount) {
        // Try to load from file path
        const serviceAccountPath = process.env.FIREBASE_ADMIN_CREDENTIALS_PATH;
        if (serviceAccountPath) {
          const fs = require('fs');
          const creds = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(creds)
          });
        } else {
          console.warn('⚠️  Firebase Admin credentials not set. FCM push notifications will not work.');
          console.warn('   Set FIREBASE_ADMIN_CREDENTIALS (JSON string) or FIREBASE_ADMIN_CREDENTIALS_PATH (file path) in .env file');
          return null;
        }
      } else {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
    }

    fcmAdmin = admin.messaging();
    console.log('✅ Firebase Admin SDK initialized');
    return fcmAdmin;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    return null;
  }
}

// Initialize provider based on feature flag
if (PUSH_PROVIDER === 'onesignal') {
  initOneSignal();
} else if (PUSH_PROVIDER === 'fcm') {
  initFCM();
} else {
  console.warn(`⚠️  Unknown push notification provider: ${PUSH_PROVIDER}. Use 'onesignal' or 'fcm'.`);
}

/**
 * Send push notification via OneSignal
 * @param {Object} options - { userId, playerExternalId, title, body, url, image }
 * @returns {Promise<void>}
 */
async function sendOneSignalNotification(options) {
  const { userId, playerExternalId, title, body, url, image } = options;
  const client = initOneSignal();
  
  if (!client) {
    throw new Error('OneSignal not initialized');
  }

  const axios = require('axios');
  
  const payload = {
    app_id: client.appId,
    headings: { en: title },
    contents: { en: body },
    url: url || '/',
    data: {
      url: url || '/',
      matchId: options.matchId
    }
  };

  // Send to specific user (external_id) if provided, otherwise use userId
  if (playerExternalId) {
    payload.include_external_user_ids = [playerExternalId];
  } else if (userId) {
    // Fallback: use userId as external_id if playerExternalId not provided
    payload.include_external_user_ids = [userId.toString()];
  } else {
    throw new Error('Either userId or playerExternalId must be provided');
  }

  if (image) {
    payload.big_picture = image;
  }

  try {
    const response = await axios.post(
      `${client.baseUrl}/notifications`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${client.apiKey}`
        }
      }
    );
    console.log('✅ OneSignal notification sent:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending OneSignal notification:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send push notification to multiple users via OneSignal
 * @param {Array} userIds - Array of userIds or playerExternalIds
 * @param {Object} payload - { title, body, url, image }
 * @returns {Promise<{ success: number, failed: number }>}
 */
async function sendOneSignalNotifications(userIds, payload) {
  let success = 0;
  let failed = 0;

  const promises = userIds.map(async (userId) => {
    try {
      await sendOneSignalNotification({
        playerExternalId: userId,
        ...payload
      });
      success++;
    } catch (error) {
      failed++;
      console.error('Failed to send OneSignal notification:', error.message);
    }
  });

  await Promise.allSettled(promises);
  return { success, failed };
}

/**
 * Send push notification via FCM
 * @param {String|Array} tokens - FCM token(s)
 * @param {Object} payload - { title, body, url, image }
 * @returns {Promise<void>}
 */
async function sendFCMNotification(tokens, payload) {
  const messaging = initFCM();
  
  if (!messaging) {
    throw new Error('FCM not initialized');
  }

  const { title, body, url, image, matchId } = payload;

  const message = {
    notification: {
      title: title,
      body: body
    },
    data: {
      url: url || '/',
      matchId: matchId || '',
      click_action: url || '/'
    },
    webpush: {
      notification: {
        title: title,
        body: body,
        icon: image || '/icons/icon-192.png',
        badge: '/icons/icon-192.png'
      },
      fcmOptions: {
        link: url || '/'
      }
    }
  };

  try {
    if (Array.isArray(tokens)) {
      const response = await messaging.sendEachForMulticast({
        tokens: tokens,
        ...message
      });
      
      console.log(`✅ FCM notifications sent: ${response.successCount} success, ${response.failureCount} failed`);
      
      // Return invalid tokens for cleanup
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && (resp.error?.code === 'messaging/invalid-registration-token' || 
                              resp.error?.code === 'messaging/registration-token-not-registered')) {
          invalidTokens.push(tokens[idx]);
        }
      });
      
      return { 
        success: response.successCount, 
        failed: response.failureCount,
        invalidTokens 
      };
    } else {
      const response = await messaging.send({
        token: tokens,
        ...message
      });
      console.log('✅ FCM notification sent:', response);
      return { success: 1, failed: 0, invalidTokens: [] };
    }
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error);
    
    // Handle invalid token
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      return { success: 0, failed: 1, invalidTokens: [tokens] };
    }
    
    throw error;
  }
}

/**
 * Send push notification to a single user
 * @param {Object} subscription - User subscription object (OneSignal: { playerExternalId }, FCM: { fcmToken })
 * @param {Object} payload - { title, body, url?, image? }
 * @returns {Promise<void>}
 */
async function sendPushNotification(subscription, payload) {
  if (PUSH_PROVIDER === 'onesignal') {
    if (!subscription || !subscription.playerExternalId) {
      throw new Error('Invalid OneSignal subscription: playerExternalId required');
    }
    await sendOneSignalNotification({
      playerExternalId: subscription.playerExternalId,
      ...payload
    });
  } else if (PUSH_PROVIDER === 'fcm') {
    if (!subscription || !subscription.fcmToken) {
      throw new Error('Invalid FCM subscription: fcmToken required');
    }
    const result = await sendFCMNotification(subscription.fcmToken, payload);
    if (result.failed > 0 && result.invalidTokens.length > 0) {
      throw new Error('SUBSCRIPTION_EXPIRED');
    }
  } else {
    throw new Error(`Unknown push notification provider: ${PUSH_PROVIDER}`);
  }
}

/**
 * Send push notification to multiple subscriptions
 * @param {Array} subscriptions - Array of subscription objects
 * @param {Object} payload - Notification payload { title, body, url?, image? }
 * @returns {Promise<{ success: number, failed: number, expiredSubscriptions: Array }>}
 */
async function sendPushNotifications(subscriptions, payload) {
  if (PUSH_PROVIDER === 'onesignal') {
    const playerExternalIds = subscriptions
      .filter(sub => sub && sub.playerExternalId)
      .map(sub => sub.playerExternalId);
    
    if (playerExternalIds.length === 0) {
      return { success: 0, failed: 0, expiredSubscriptions: [] };
    }

    const result = await sendOneSignalNotifications(playerExternalIds, payload);
    return { 
      success: result.success, 
      failed: result.failed, 
      expiredSubscriptions: [] // OneSignal doesn't provide expired subscriptions in this format
    };
  } else if (PUSH_PROVIDER === 'fcm') {
    const fcmTokens = subscriptions
      .filter(sub => sub && sub.fcmToken)
      .map(sub => sub.fcmToken);

    if (fcmTokens.length === 0) {
      return { success: 0, failed: 0, expiredSubscriptions: [] };
    }

    const result = await sendFCMNotification(fcmTokens, payload);
    
    // Map invalid tokens back to subscription objects
    const expiredSubscriptions = subscriptions.filter(sub => 
      sub && sub.fcmToken && result.invalidTokens.includes(sub.fcmToken)
    );

    return {
      success: result.success || 0,
      failed: result.failed || 0,
      expiredSubscriptions
    };
  } else {
    throw new Error(`Unknown push notification provider: ${PUSH_PROVIDER}`);
  }
}

/**
 * Get current push notification provider
 * @returns {String} 'onesignal' | 'fcm'
 */
function getProvider() {
  return PUSH_PROVIDER;
}

module.exports = {
  sendPushNotification,
  sendPushNotifications,
  sendOneSignalNotification,
  sendFCMNotification,
  getProvider,
  // For backward compatibility - will be removed
  getVapidPublicKey: () => {
    console.warn('⚠️  getVapidPublicKey() is deprecated. VAPID is no longer supported.');
    return null;
  }
};
