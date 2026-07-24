const CACHE_NAME = 'portal-lm-static-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/portal.css',
  '/portal-shared.js',
  '/assets/css/portal.css',
  '/assets/js/lm-access.js',
  '/assets/js/pwa-register.js',
  '/assets/logo-lm-gold.png'
];
const STATIC_EXTENSIONS = /\.(?:css|js|mjs|woff2?|ttf|otf|eot|png|svg|ico|webp|avif|gif)$/i;

function unauthenticatedRequest(url) {
  return new Request(url, { credentials: 'omit', cache: 'reload' });
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(PRECACHE_URLS.map(async (url) => {
    const response = await fetch(unauthenticatedRequest(url));
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function isCacheableStaticRequest(request, url) {
  if (url.pathname === '/manifest.webmanifest') return true;
  return ['style', 'script', 'font', 'image'].includes(request.destination)
    || STATIC_EXTENSIONS.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!isCacheableStaticRequest(request, url) || request.headers.has('authorization')) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(unauthenticatedRequest(request.url));
    const cacheControl = response.headers.get('cache-control') || '';
    if (response.ok && response.type === 'basic' && !/(?:private|no-store)/i.test(cacheControl)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
