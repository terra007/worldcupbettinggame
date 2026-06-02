const CACHE = 'wc2026-v1';
const PRECACHE = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Never intercept API calls — they must always be fresh
  if (event.request.url.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
      // Serve cache instantly, update in background (stale-while-revalidate)
      return cached || network;
    })
  );
});
