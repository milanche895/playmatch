// Push Notification Service - PWA Web Push with VAPID
// Uses native browser Push API with web-push library

const webpush = require('web-push');

// VAPID keys from environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@playmatch.com';

// Initialize VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ VAPID keys configured for push notifications');
} else {
  console.warn('⚠️  VAPID keys not set. Push notifications will not work.');
  console.warn('   Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in .env file');
  console.warn('   Generate keys with: npx web-push generate-vapid-keys');
}

/**
 * Get VAPID public key
 * @returns {String} VAPID public key
 */
function getVapidPublicKey() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured');
  }
  return VAPID_PUBLIC_KEY;
}

/**
 * Send push notification to a single subscription
 * @param {Object} subscription - PushSubscription object (with endpoint and keys)
 * @param {Object} payload - { title, body, url?, image?, matchId? }
 * @returns {Promise<void>}
 */
async function sendPushNotification(subscription, payload) {
  if (!subscription || !subscription.endpoint) {
    throw new Error('Invalid push subscription: endpoint required');
  }

  const { title, body, url, image, matchId } = payload;

  const notificationPayload = JSON.stringify({
    title: title || 'Plejko',
    body: body || 'Novi meč je kreiran u blizini!',
    icon: image || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: matchId ? `match-${matchId}` : 'plejko-notification',
    data: {
      url: url || '/',
      matchId: matchId || ''
    },
    vibrate: [200, 100, 200],
    requireInteraction: false
  });

  try {
    await webpush.sendNotification(subscription, notificationPayload);
    console.log('✅ Push notification sent');
    return { success: 1, failed: 0 };
  } catch (error) {
    console.error('❌ Error sending push notification:', error);

    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or not found
      return { success: 0, failed: 1, expired: true };
    }

    throw error;
  }
}

/**
 * Send push notification to multiple subscriptions
 * @param {Array} subscriptions - Array of PushSubscription objects
 * @param {Object} payload - Notification payload { title, body, url?, image?, matchId? }
 * @returns {Promise<{ success: number, failed: number, expiredSubscriptions: Array }>}
 */
async function sendPushNotifications(subscriptions, payload) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { success: 0, failed: 0, expiredSubscriptions: [] };
  }

  let success = 0;
  let failed = 0;
  const expiredSubscriptions = [];

  const promises = subscriptions.map(async (subscription) => {
    try {
      const result = await sendPushNotification(subscription, payload);
      if (result.success > 0) {
        success++;
      } else {
        failed++;
        if (result.expired) {
          expiredSubscriptions.push(subscription);
        }
      }
    } catch (error) {
      failed++;
      console.error('Failed to send push notification:', error.message);
      
      // Check if subscription is expired
      if (error.statusCode === 410 || error.statusCode === 404) {
        expiredSubscriptions.push(subscription);
      }
    }
  });

  await Promise.allSettled(promises);

  console.log(`✅ Sent ${success} push notifications, ${failed} failed`);

  return {
    success,
    failed,
    expiredSubscriptions
  };
}

module.exports = {
  getVapidPublicKey,
  sendPushNotification,
  sendPushNotifications
};