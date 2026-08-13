// Push Notification Service - PWA Web Push with VAPID
// Uses native browser Push API with web-push library

const webpush = require('web-push');

// VAPID keys from environment variables
const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim().replace(/^["']|["']$/g, '');
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || 'mailto:admin@playmatch.com').trim();

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

function describeSubscription(subscription) {
  if (!subscription) return { present: false };
  const raw = typeof subscription.toObject === 'function' ? subscription.toObject() : subscription;
  const endpoint = raw?.endpoint || subscription.endpoint || null;
  const keys = raw?.keys || subscription.keys || {};
  let endpointHost = null;
  if (endpoint) {
    try {
      endpointHost = new URL(endpoint).host;
    } catch {
      endpointHost = 'invalid-url';
    }
  }
  return {
    present: true,
    hasEndpoint: Boolean(endpoint),
    endpointHost,
    hasP256dh: Boolean(keys && keys.p256dh),
    hasAuth: Boolean(keys && keys.auth),
    fields: Object.keys(raw || {})
  };
}

function hasPushEndpoint(subscription) {
  return describeSubscription(subscription).hasEndpoint === true;
}

/**
 * Send push notification to a single subscription
 * @param {Object} subscription - PushSubscription object (with endpoint and keys)
 * @param {Object} payload - { title, body, url?, image?, matchId?, tag?, requireInteraction? }
 * @returns {Promise<void>}
 */
async function sendPushNotification(subscription, payload) {
  const subInfo = describeSubscription(subscription);
  console.log('[PushDebug] sendPushNotification start', {
    title: payload?.title,
    matchId: payload?.matchId,
    tag: payload?.tag,
    vapidConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    subscription: subInfo
  });

  if (!subscription || !subscription.endpoint) {
    console.warn('[PushDebug] abort: missing endpoint', subInfo);
    throw new Error('Invalid push subscription: endpoint required');
  }

  const { title, body, url, image, matchId, tag, requireInteraction } = payload;

  const notificationPayload = JSON.stringify({
    title: title || 'Plejko',
    body: body || 'Novi meč je kreiran u blizini!',
    icon: image || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: tag || (matchId ? `match-${matchId}` : 'plejko-notification'),
    data: {
      url: url || '/',
      matchId: matchId || ''
    },
    vibrate: requireInteraction ? [300, 100, 300, 100, 300] : [200, 100, 200],
    requireInteraction: Boolean(requireInteraction)
  });

  try {
    await webpush.sendNotification(subscription, notificationPayload);
    console.log('[PushDebug] web-push accepted notification', {
      title,
      endpointHost: subInfo.endpointHost
    });
    return { success: 1, failed: 0 };
  } catch (error) {
    console.error('[PushDebug] web-push rejected notification', {
      title,
      endpointHost: subInfo.endpointHost,
      statusCode: error.statusCode,
      message: error.message,
      body: error.body
    });

    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.warn('[PushDebug] subscription expired/not found — will be cleared');
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
  console.log('[PushDebug] sendPushNotifications batch', {
    count: Array.isArray(subscriptions) ? subscriptions.length : 0,
    title: payload?.title,
    matchId: payload?.matchId
  });

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    console.warn('[PushDebug] batch empty — nothing to send');
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

  console.log('[PushDebug] batch finished', { success, failed, expired: expiredSubscriptions.length });

  return {
    success,
    failed,
    expiredSubscriptions
  };
}

module.exports = {
  getVapidPublicKey,
  sendPushNotification,
  sendPushNotifications,
  hasPushEndpoint,
  describeSubscription
};
