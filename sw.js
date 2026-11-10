const CACHE_NAME = 'foto-live-v5.3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-32.png',
  './icons/screenshot-mobile.png',
  './icons/screenshot-wide.png'
];

// Install: pre-cache all core static assets & skipWaiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some optional assets could not be cached immediately:', err);
      });
    })
  );
});

// Activate: delete all old caches, claim clients, and force-navigate open windows if upgrading from an old cache!
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const oldKeys = keys.filter((key) => key !== CACHE_NAME);
      const hadOldCache = oldKeys.length > 0;

      return Promise.all(oldKeys.map((key) => caches.delete(key)))
        .then(() => self.clients.claim())
        .then(() => {
          if (hadOldCache) {
            return self.clients.matchAll({ type: 'window' }).then((windowClients) => {
              return Promise.all(
                windowClients.map((client) => {
                  if ('navigate' in client) {
                    return client.navigate(client.url).catch(() => {});
                  }
                })
              );
            });
          }
        });
    })
  );
});

// Listen for skipWaiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Network-first with cache-busting bypass so updates always appear immediately
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET' || !req.url.startsWith('http')) {
    return;
  }

  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) {
    return;
  }

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (req.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
  );
});
