const CACHE_NAME = 'flowify-v4';
const BASE = '/Flowify';
const APP_SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Don't cache YouTube API/IFrame calls
  if (url.hostname.includes('youtube') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) return;

  event.respondWith(
    caches.match(event.request).then(async cached => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      } catch {
        if (event.request.mode === 'navigate') return caches.match(BASE + '/index.html');
        throw new Error('offline');
      }
    })
  );
});
