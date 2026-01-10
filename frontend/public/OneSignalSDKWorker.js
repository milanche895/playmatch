// OneSignal Service Worker
// This file is required by OneSignal and must be at the root of your domain
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[OneSignal Worker] Notification click received');

  event.notification.close();

  const urlToOpen = event.notification.data?.url || event.notification.data?.launchURL || '/';
  
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
