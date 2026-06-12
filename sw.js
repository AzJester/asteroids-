// Service worker: precache the static app shell for offline play. Bump CACHE
// when any shell file changes so clients pick up the new version.
const CACHE = 'asteroids-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './src/main.js',
  './src/constants.js',
  './src/input.js',
  './src/audio.js',
  './src/game.js',
  './src/touch.js',
  './src/gamepad.js',
  './src/settings.js',
  './src/crt.js',
  './src/render.js',
  './src/font.js',
  './src/leaderboard.js',
  './src/remote-leaderboard.js',
  './src/supabase-config.js',
  './src/entities/ship.js',
  './src/entities/bullet.js',
  './src/entities/asteroid.js',
  './src/entities/saucer.js',
  './src/entities/debris.js',
  './src/util/vec.js',
  './src/util/wrap.js',
  './src/util/rng.js',
  './src/util/collision.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs. Cross-origin calls (e.g. the Supabase
  // leaderboard) always go straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Cache successful same-origin responses for next time.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
