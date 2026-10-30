// Offline support: network first (so updates show up right away),
// falling back to the cached copy when there's no connection.
// The deploy build replaces the cache name with the commit version, so a
// new deploy drops the old cached *files*. Player progress lives in
// localStorage, which this never touches.

const CACHE = 'free-the-x-dev';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/engine.js',
  'js/fraction.js',
  'js/levels.js',
  'js/render.js',
  'js/storage.js',
  'js/audio.js',
  'js/fx.js',
  'icon.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // 'no-cache' revalidates with the server instead of trusting the
    // browser's HTTP cache (GitHub Pages caches files for 10 minutes).
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
