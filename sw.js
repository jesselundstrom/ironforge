const CACHE = 'ironforge-v9';

// Only cache local assets — Google Fonts URLs can fail offline and would
// break the entire SW install. Fonts are cached on first successful fetch.
const PRE_CACHE = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'core/data-layer.js',
  'core/program-layer.js',
  'core/dashboard-layer.js',
  'core/history-layer.js',
  'core/workout-layer.js',
  'manifest.json',
  'programs/forge.js',
  'programs/wendler531.js',
  'programs/stronglifts5x5.js',
  'programs/casualfullbody.js',
  'icon-180.png',
  'icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRE_CACHE))
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isStaticAsset = isSameOrigin && (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image' ||
    url.pathname.endsWith('.json')
  );

  // Network-first for HTML/documents keeps app updates fresher.
  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
    );
    return;
  }

  // Stale-while-revalidate for static assets gives fast loads with background refresh.
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Default fallback for everything else.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
