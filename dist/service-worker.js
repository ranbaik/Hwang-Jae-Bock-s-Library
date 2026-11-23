const CACHE_NAME = 'hjb-library-v14-canon';
const BASE_PATH = new URL('./', self.registration.scope).pathname;
const INDEX_PATH = `${BASE_PATH}index.html`;
const APP_SHELL = [BASE_PATH, INDEX_PATH, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}app-icon.svg`, `${BASE_PATH}canon-music.js`, `${BASE_PATH}background-music.js`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hjb-library-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    const path = new URL(event.request.url).pathname;
    const isHome = path === BASE_PATH || path === INDEX_PATH;
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          // only the home page may refresh the offline copy of index.html; sub-pages are cached under their own URL
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(isHome ? INDEX_PATH : event.request, copy));
          return response;
        })
        .catch(() => caches.match(isHome ? INDEX_PATH : event.request).then((cached) => cached || caches.match(INDEX_PATH)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
