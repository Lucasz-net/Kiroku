// Subir esta versión cada vez que cambie index.html: el Service Worker
// responde primero desde la caché, así que sin este cambio quien ya visitó el
// sitio seguiría recibiendo el HTML viejo —con el título y los iconos
// anteriores— para siempre. Al cambiar el nombre, 'activate' borra la caché
// anterior y vuelve a precachear '/'.
const CACHE = 'kiroku-v3';
const JIKAN_CACHE = 'kiroku-jikan-v1';
const JIKAN_CACHE_LIMIT = 150;
const PRECACHE = ['/', '/logo.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== JIKAN_CACHE).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) await cache.delete(keys[0]);
}

// Stale-while-revalidate for the Jikan API: serve cached anime data instantly
// (or fall back to it during outages) while refreshing it in the background.
function handleJikanRequest(request) {
  return caches.open(JIKAN_CACHE).then(async cache => {
    const cached = await cache.match(request);

    const networkFetch = fetch(request).then(resp => {
      if (resp.status === 200) {
        cache.put(request, resp.clone());
        trimCache(JIKAN_CACHE, JIKAN_CACHE_LIMIT);
      }
      return resp;
    });

    if (cached) {
      networkFetch.catch(() => {});
      return cached;
    }

    return networkFetch;
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  if (url.includes('api.jikan.moe')) {
    e.respondWith(handleJikanRequest(e.request));
    return;
  }

  if (url.includes('supabase.co')) return;

  // Las portadas vienen de AniList/MAL y son cross-origin. La CSP las permite
  // vía img-src (que acepta cualquier https:), pero el fetch() que hace este
  // Service Worker para cachearlas se evalúa contra connect-src, que solo
  // lista los hosts a los que la app llama por API — no los de imágenes. Sin
  // este chequeo, cada portada nueva quedaba bloqueada por CSP (net::ERR_FAILED
  // en el <img>, más un rechazo sin capturar acá) apenas la cache estaba vacía,
  // como pasó al mudar de dominio y arrancar con la Cache Storage en blanco.
  if (e.request.destination === 'image') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.status === 200 && e.request.destination !== 'document') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
