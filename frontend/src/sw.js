// Service Worker for Push Notifications
// This file will be used by VitePWA plugin with injectManifest strategy

import { precacheAndRoute } from 'workbox-precaching';

// Precache files (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log('[Service Worker] Push had this data: ', event.data);

  // Default notification data
  let notificationData = {
    title: 'PlayMatch',
    body: 'Novi meč je kreiran u blizini!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'playmatch-notification',
    data: {
      url: '/'
    }
  };

  // Parse push data
  if (event.data) {
    try {
      let data = null;
      
      // Try to parse as JSON first
      try {
        data = event.data.json();
        console.log('[Service Worker] Parsed JSON data:', data);
      } catch (jsonError) {
        // If JSON parsing fails, try as text
        try {
          const textData = event.data.text();
          console.log('[Service Worker] Received text data:', textData);
          
          // Try to parse text as JSON
          if (textData && textData.trim().startsWith('{')) {
            try {
              data = JSON.parse(textData);
              console.log('[Service Worker] Parsed text as JSON:', data);
            } catch (parseError) {
              // Not valid JSON, use as plain text body
              console.log('[Service Worker] Text is not JSON, using as notification body');
              data = { body: textData };
            }
          } else {
            // Plain text, use as body
            console.log('[Service Worker] Using plain text as notification body');
            data = { body: textData };
          }
        } catch (textError) {
          console.error('[Service Worker] Error reading text data:', textError);
          // Use default data (data remains null)
        }
      }
      
      // Merge parsed data with defaults (only if data was successfully parsed)
      if (data) {
        notificationData = {
          title: data.title || 'PlayMatch',
          body: data.body || 'Novi meč je kreiran u blizini!',
          icon: data.icon || '/icons/icon-192.png',
          badge: data.badge || '/icons/icon-192.png',
          tag: data.tag || (data.matchId ? `match-${data.matchId}` : 'playmatch-notification'),
          data: {
            url: data.data?.url || data.url || '/',
            matchId: data.data?.matchId || data.matchId
          },
          vibrate: data.vibrate || [200, 100, 200],
          requireInteraction: data.requireInteraction || false
        };
      }
    } catch (e) {
      console.error('[Service Worker] Error parsing push notification data:', e);
      // Continue with default notification data
    }
  }

  // Try to show notification
  // Note: We can't check permission directly in service worker,
  // so we try to show and handle the error gracefully
  const promiseChain = self.registration.showNotification(notificationData.title, notificationData)
    .then(function() {
      console.log('[Service Worker] ✅ Notification shown successfully');
    })
    .catch(function(error) {
      // Permission denied or other error
      if (error.message && (error.message.includes('permission') || error.name === 'NotAllowedError')) {
        console.warn('[Service Worker] ⚠️ Notification permission not granted.');
        console.warn('[Service Worker] User needs to grant notification permission in the app.');
        console.warn('[Service Worker] Go to Player Profile page and allow notifications when prompted.');
      } else {
        console.error('[Service Worker] ❌ Failed to show notification:', error);
      }
      // Don't throw - gracefully handle the error
    });

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
