// CoupleCart service worker: keeps the app itself available without signal.
// The list data is stored separately, in localStorage, by useGroceryItems.
const CACHE = 'couplecart-app-v1';
const MAX_ASSETS = 40;

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
