const CACHE = 'qhp-v28';
// Big, rarely-changing static assets - safe to cache-first.
const STATIC_ASSETS = [
  './assets/quran/quran-indopak.json',
  './assets/quran/quran-uthmani.json',
  './assets/quran/word-meanings.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace(/^\.\//, '/')));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === 'everyayah.com') return;
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    // Cache-first for big static assets.
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // Network-first for HTML / JS / CSS - deploys land without manual SW kick.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
