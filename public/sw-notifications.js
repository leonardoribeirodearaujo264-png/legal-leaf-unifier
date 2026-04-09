// Service Worker for native OS notifications (near system clock)
// This ensures notifications work even when the tab is minimized or inactive

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId
    ? `/mensagens?openConversation=${conversationId}`
    : '/mensagens';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing tab
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
      // No existing tab — open a new one
      return clients.openWindow(targetUrl);
    })
  );
});

// Keep the SW alive for showNotification calls from the page
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
