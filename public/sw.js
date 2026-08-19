self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function (event) {
  var notificationData = {
    title: 'Plejko',
    body: 'Novi meč je kreiran u blizini!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'playmatch-notification',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      var data = null;
      try {
        data = event.data.json();
      } catch (jsonError) {
        try {
          var textData = event.data.text();
          if (textData && textData.trim().indexOf('{') === 0) {
            try {
              data = JSON.parse(textData);
            } catch (parseError) {
              data = { body: textData };
            }
          } else {
            data = { body: textData };
          }
        } catch (textError) {
          data = null;
        }
      }

      if (data) {
        notificationData = {
          title: data.title || 'Plejko',
          body: data.body || 'Novi meč je kreiran u blizini!',
          icon: data.icon || '/icons/icon-192.png',
          badge: data.badge || '/icons/icon-192.png',
          tag: data.tag || (data.matchId ? 'match-' + data.matchId : 'playmatch-notification'),
          data: {
            url: (data.data && data.data.url) || data.url || '/',
            matchId: (data.data && data.data.matchId) || data.matchId
          },
          vibrate: data.vibrate || [200, 100, 200],
          requireInteraction: data.requireInteraction || false
        };
      }
    } catch (e) {
      console.error('[Service Worker] Error parsing push notification data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData).catch(function (error) {
      console.error('[PushDebug][SW] showNotification failed', error);
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
