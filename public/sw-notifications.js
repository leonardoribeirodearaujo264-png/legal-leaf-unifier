// Service Worker for native OS notifications (near system clock)

// Handle push events from the server — works even when tab is minimized/suspended
self.addEventListener('push', (event) => {
  let data = { title: 'Nova mensagem', body: '', conversationId: null };
  try {
    data = event.data?.json() || data;
  } catch {
    data.body = event.data?.text() || '';
  }

  const options = {
    body: data.body,
    icon: '/logo-eggnunes.png',
    tag: `msg-${data.conversationId || 'general'}`,
    data: { conversationId: data.conversationId },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId
    ? `/mensagens?openConversation=${conversationId}`
    : '/mensagens';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            conversationId,
          });
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
