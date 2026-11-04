/* Lines service worker: keeps the app shell and fonts available offline.
   The library's content is never fetched or cached here; it lives in IndexedDB on the device. */
const SHELL_CACHE = 'lines-shell-v24';
const FONT_CACHE = 'lines-fonts';
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/zip.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never installs old files.
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      // Drop the segmentation model kept for a photo style that was removed.
      .then(() => caches.open(FONT_CACHE))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => /mediapipe/.test(r.url)).map((r) => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Online: always ask the network first, so changes show up on the next open.
    // Offline or slow: fall back to the saved copy after a few seconds.
    e.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const network = fetch(req, { cache: 'no-cache' })
        .then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => null);
      const fresh = await withTimeout(network, 3500);
      if (fresh) return fresh;
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) { e.waitUntil(network); return cached; }
      return (await network) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Fonts are fixed versions: keep the first copy so they also work offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
  }
});
