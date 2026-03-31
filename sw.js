const CACHE = 'ironforge-v59';

// Only cache local assets — Google Fonts URLs can fail offline and would
// break the entire SW install. Fonts are cached on first successful fetch.
const PRE_CACHE = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRE_CACHE)));
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isDocument =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document';
  const isCodeAsset =
    isSameOrigin &&
    (event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.json'));
  const isBundledAsset = isSameOrigin && url.pathname.startsWith('/assets/');
  const isImageAsset = isSameOrigin && event.request.destination === 'image';

  // Network-first for HTML/documents keeps app updates fresher.
  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Network-first for app code avoids serving stale JS/CSS after local changes or deploys.
  // The cache.put is awaited inside respondWith so it completes before the response
  // is released — this prevents a race where the page goes offline before async
  // caching finishes. ignoreSearch handles Vite dev-mode ?t= / ?v= query params
  // that differ between the cached URL and the incoming request URL.
  if (isCodeAsset || isBundledAsset) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (
            response &&
            response.status === 200 &&
            response.type !== 'opaque'
          ) {
            const copy = response.clone();
            const cache = await caches.open(CACHE);
            await cache.put(event.request, copy);
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Stale-while-revalidate is fine for images and keeps repeat loads fast.
  if (isImageAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (
              response &&
              response.status === 200 &&
              response.type !== 'opaque'
            ) {
              const copy = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Default fallback for everything else.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque')
          return response;
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
