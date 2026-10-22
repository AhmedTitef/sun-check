// Keeps the coach, the print kit and the page working with no signal in the store.
// Only this site's own files are cached; map, sun and form requests go straight out.

const VERSION = 'suncheck-v1';
const SHELL = [
  './',
  './index.html',
  './rep/',
  './rep/index.html',
  './rep/manifest.webmanifest',
  './print/',
  './print/index.html',
  './setup/',
  './setup/index.html',
  './assets/css/base.css',
  './assets/css/rep.css',
  './assets/css/print.css',
  './assets/css/customer.css',
  './assets/css/setup.css',
  './assets/js/util.js',
  './assets/js/store.js',
  './assets/js/content.js',
  './assets/js/texts.js',
  './assets/js/sample.js',
  './assets/js/rep.js',
  './assets/js/print.js',
  './assets/js/customer.js',
  './assets/js/roof.js',
  './assets/js/estimate.js',
  './assets/js/bill.js',
  './assets/vendor/qrcode.js',
  './assets/img/icon.svg',
  './assets/img/icon-180.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if (!own && !FONT_HOSTS.includes(url.hostname)) return;

  // Pages: try the network briefly so updates arrive, fall back to the cached copy.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const fresh = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))]);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Files and fonts: answer from cache at once, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: own });
    const refresh = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await refresh) || Response.error();
  })());
});
