const CACHE_NAME = 'foto-live-v2.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-32.png',
  './assets/anti_gravity_preview.jpg'
];

// Install: pre-cache all core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some optional assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first for documents/navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Only handle GET requests and http/https schemes
  if (req.method !== 'GET' || !req.url.startsWith('http')) {
    return;
  }

  // Camera stream, blobs or video data shouldn't be handled by cache
  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback to cached index.html for navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
