/* Lines service worker: keeps the app shell and fonts available offline.
   The library's content is never fetched or cached here; it lives in IndexedDB on the device. */
const SHELL_CACHE = 'lines-shell-v4';
const FONT_CACHE = 'lines-fonts';
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/zip.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Serve from cache at once, refresh in the background: updates appear on the next open.
    e.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req).then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      return (await network) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
  }
});
