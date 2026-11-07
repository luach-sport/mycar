/* MyCar's offline copy for the web version and for iPhone (added to the home screen from Safari).
   The Android app never uses it. When the website is built, scripts/web-app.mjs writes the list of the
   app's files and a version made from their contents into VERSION and FILES below; a new version is
   downloaded in full in the background and only then replaces the old one, so the app always opens. */
const VERSION = "8e3612171740";
const FILES = ["cap-runtime.js","data/fuel.json","data/localities.json","data/manifest.json","data/roads.json","fonts/Rubik-var.ttf","icon-180.png","icon-512.png","icon-maskable-512.png","icon.png","index.html","js/app.js","js/core.js","js/engine.js","js/install-ios.js","js/share-app.js","js/snap.js","js/ui.js","js/update.js","js/version.js","js/web-app.js","js/web-share.js","logo.svg","manifest.webmanifest","styles.css"];
const CACHE = 'mycar-' + VERSION;
const DEV = VERSION === 'dev';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (!DEV) {
      const cache = await caches.open(CACHE);
      // All or nothing: if one file fails, this version is not installed and the previous one keeps working.
      await cache.addAll(['./'].concat(FILES).map((f) => new Request(f, { cache: 'reload' })));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('mycar-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only the app's own files. Routes, addresses, fresh data and feedback go straight to the internet.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(DEV ? fromNetwork(req) : fromCache(req));
});

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? './' : req;
  const hit = await cache.match(key, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function fromNetwork(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}
