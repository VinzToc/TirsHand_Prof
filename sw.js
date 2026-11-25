/* TirsHand Prof — service worker : réseau d'abord (délai 2,5 s), copie locale en secours */
importScripts('./version.js');
const CACHE = 'tirshand-prof-v' + APP_VERSION; // version définie dans version.js
const FICHIERS = ['footer.js','nouveautes.js','nouveautes.json',
  './',
  './index.html',
  './version.js',
  './app.js',
  './style.css',
  './eps-core.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k.startsWith('tirshand-prof-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const reseau = fetch(req).then(rep => {
      if (rep && rep.ok) cache.put(req, rep.clone());
      return rep;
    });
    reseau.catch(() => {});
    const delai = new Promise(ok => setTimeout(ok, 2500, 'delai'));
    try {
      const r = await Promise.race([reseau, delai]);
      if (r !== 'delai') return r;
    } catch (err) { /* hors ligne : on passe à la copie locale */ }
    const copie = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return copie || reseau;
  })());
});
