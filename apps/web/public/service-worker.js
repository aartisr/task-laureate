/* Task Laureate's sole root-scoped worker: app-shell resilience + Web Push. */
const CACHE_NAME = 'task-laureate-shell-v1';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/icons/task-laureate-192.png', '/icons/task-laureate-512.png', '/icons/task-laureate-maskable-512.png', '/icons/apple-touch-icon-180.png'];

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
};

self.addEventListener('install', (event) => event.waitUntil(cacheAppShell()));
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter((name) => name.startsWith('task-laureate-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

const isCacheableAsset = (request, url) => request.method === 'GET' && url.origin === self.location.origin && !url.pathname.startsWith('/api/') && ['script', 'style', 'font', 'image'].includes(request.destination);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        (await caches.open(CACHE_NAME)).put('/index.html', response.clone());
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
      }
    })());
    return;
  }
  if (!isCacheableAsset(request, url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const refresh = fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    });
    return cached || refresh;
  })());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Task-Laureate reminder', body: 'Open Task-Laureate to review your tasks.', url: '/' };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* A malformed payload must still be safe. */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icons/task-laureate-192.png',
    badge: '/icons/task-laureate-192.png',
    data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/' },
    tag: `task-laureate:${payload.eventId ?? 'reminder'}`,
    renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(destination)) : self.clients.openWindow(destination);
  }));
});
