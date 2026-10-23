// CoupleCart service worker: keeps the app itself available without signal.
// The list data is stored separately, in localStorage, by useGroceryItems.
// Raise the version when favicon.png changes: it is kept under the same name.
const CACHE = 'couplecart-app-v2';
// One version is ~30 files since parts of the app load on demand; this keeps the current one whole.
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/favicon.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Every deploy brings new asset names; keep only the most recent ones.
async function trimAssets(cache) {
  const assets = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/assets/'));
  await Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map((request) => cache.delete(request)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network first, so a new version shows up right away; the stored page is for the store without signal.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.png') {
    // Built file names change with every version, so a stored copy is always the right one.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(async (cache) => {
            await cache.put(request, copy);
            await trimAssets(cache);
          }));
        }
        return response;
      })),
    );
  }
});

// Pushmeldingen van push-send: { title, body, soort, tab }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'CoupleCart', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'CoupleCart', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    // Een nieuwe melding van dezelfde soort vervangt de oude in plaats van zich op te stapelen.
    tag: data.soort || 'couplecart',
    renotify: true,
    data: { tab: data.tab || 'list' },
  }));
});

// Tik op een melding: de open app naar voren op de goede tab, anders de app openen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tab = event.notification.data?.tab || 'list';
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = open.find((c) => new URL(c.url).origin === self.location.origin);
    if (client) {
      client.postMessage({ type: 'open-tab', tab });
      return client.focus();
    }
    return self.clients.openWindow(`/#/?tab=${encodeURIComponent(tab)}`);
  })());
});
