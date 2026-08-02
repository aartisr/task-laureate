/* Web Push worker. It deliberately has no offline-cache responsibility. */
self.addEventListener('push', (event) => {
  let payload = { title: 'Task-Laureate reminder', body: 'Open Task-Laureate to review your tasks.', url: '/' };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* A malformed push must still display a safe notification. */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/' },
    tag: `task-laureate:${payload.eventId ?? 'reminder'}`,
    renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(destination)) : clients.openWindow(destination);
  }));
});
