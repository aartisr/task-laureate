/* Task Laureate's sole root-scoped worker: app-shell resilience + Web Push. */
// Bump this whenever a recovery release must evict a stale app shell. Keeping
// an old namespace can leave an installed iOS app on an obsolete bundle even
// after the Vercel deployment has changed.
const CACHE_NAME = 'task-laureate-shell-v3';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/icons/task-laureate-192.png', '/icons/task-laureate-512.png', '/icons/task-laureate-maskable-512.png', '/icons/apple-touch-icon-180.png'];

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
};

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil((async () => { await self.skipWaiting(); })());
});

self.addEventListener('install', (event) => event.waitUntil((async () => {
  await cacheAppShell();
  // Updates wait for the app's unobtrusive reload prompt. This avoids replacing
  // loaded JavaScript while someone is editing a task.
})()));
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter((name) => name.startsWith('task-laureate-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

const isCacheableAsset = (request, url) => request.method === 'GET' && url.origin === self.location.origin && !url.pathname.startsWith('/api/') && ['script', 'style', 'font', 'image'].includes(request.destination);
const hasExpectedAssetType = (request, response) => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (request.destination === 'script') return /(?:java|ecma)script|module/.test(contentType);
  if (request.destination === 'style') return contentType.includes('text/css');
  if (request.destination === 'font') return /font|octet-stream/.test(contentType);
  if (request.destination === 'image') return contentType.startsWith('image/');
  return false;
};

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
      // Vercel's SPA fallback returns index.html with 200 for a chunk that no
      // longer exists after a deployment. Never cache that HTML under a JS
      // URL; doing so turns one transient stale-tab error into a persistent
      // iOS MIME failure.
      if (response.ok && hasExpectedAssetType(request, response)) (await caches.open(CACHE_NAME)).put(request, response.clone());
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
