const webpush = require('web-push');

// VAPID keys - should be in .env file
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';

// Set VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️  VAPID keys not set. Push notifications will not work.');
  console.warn('   Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in .env file');
  console.warn('   Generate keys with: npx web-push generate-vapid-keys');
}

/**
 * Send push notification to a single subscription
 * @param {Object} subscription - Push subscription object (from pushSubscription field)
 * @param {Object} payload - Notification payload { title, body, url?, icon? }
 * @returns {Promise<void>}
 */
async function sendPushNotification(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured');
  }

  if (!subscription || !subscription.endpoint) {
    throw new Error('Invalid subscription');
  }

  try {
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: payload.url || '/',
        matchId: payload.matchId
      },
      vibrate: [200, 100, 200],
      tag: payload.matchId ? `match-${payload.matchId}` : 'playmatch-notification',
      requireInteraction: false
    });

    await webpush.sendNotification(subscription, notificationPayload);
    console.log('✅ Push notification sent successfully');
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    
    // If subscription is invalid (410 Gone), mark it for removal
    if (error.statusCode === 410 || error.statusCode === 404) {
      throw new Error('SUBSCRIPTION_EXPIRED');
    }
    throw error;
  }
}

/**
 * Send push notification to multiple subscriptions
 * @param {Array} subscriptions - Array of subscription objects
 * @param {Object} payload - Notification payload
 * @returns {Promise<{ success: number, failed: number }>}
 */
async function sendPushNotifications(subscriptions, payload) {
  let success = 0;
  let failed = 0;
  const expiredSubscriptions = [];

  const promises = subscriptions.map(async (subscription) => {
    try {
      await sendPushNotification(subscription, payload);
      success++;
    } catch (error) {
      failed++;
      if (error.message === 'SUBSCRIPTION_EXPIRED') {
        expiredSubscriptions.push(subscription);
      }
      console.error('Failed to send notification:', error.message);
    }
  });

  await Promise.allSettled(promises);

  return { success, failed, expiredSubscriptions };
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

module.exports = {
  sendPushNotification,
  sendPushNotifications,
  getVapidPublicKey
};
