// Estrategia de caché. La regla de oro: el HTML NUNCA se sirve desde caché
// estando online. Antes este Service Worker respondía todo con "caché primero"
// y precacheaba '/', así que después de cada deploy el navegador seguía
// mostrando el index.html viejo —y con él los /assets/*.js viejos— hasta que
// alguien hiciera Ctrl+F5 (que saltea el Service Worker) o borrara los datos
// del sitio. Ahora la navegación va siempre a la red y la copia cacheada de
// '/' queda solo como respaldo para cuando no hay conexión.
//
// Subir VERSION al tocar este archivo: 'activate' borra las cachés viejas.
const VERSION = 'v4';
const CACHE = `kiroku-${VERSION}`;
const JIKAN_CACHE = 'kiroku-jikan-v1';
const JIKAN_CACHE_LIMIT = 150;
const OFFLINE_URL = '/';
const PRECACHE = [OFFLINE_URL, '/logo.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // `cache: 'reload'` evita precachear desde el caché HTTP del navegador:
      // sin esto el respaldo offline podría nacer ya desactualizado.
      c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))
    )
  );
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

function putInCache(request, response) {
  if (response.status !== 200) return;
  const clone = response.clone();
  caches.open(CACHE).then(c => c.put(request, clone));
}

// Navegación (el HTML). Red primero: cada F5 trae el index.html real, con los
// nombres con hash de los assets del build actual. La caché solo entra si la
// red falla, para que la app siga abriendo sin conexión.
async function handleNavigation(request) {
  try {
    const resp = await fetch(request);
    // La app es una SPA: cualquier ruta devuelve el mismo shell, así que la
    // respuesta buena de hoy sirve como respaldo offline de mañana.
    if (resp.status === 200) putInCache(OFFLINE_URL, resp);
    return resp;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

// /assets/*: Vite les pone un hash de contenido en el nombre, así que una URL
// dada nunca cambia. Caché primero es correcto y es lo que hace que la app
// arranque instantánea.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const resp = await fetch(request);
  putInCache(request, resp);
  return resp;
}

// Datos de /api/*: red primero. La caché es solo el plan B sin conexión —
// cachearlos "para siempre" como antes dejaba congelados el ranking y el
// puntaje de MAL hasta el siguiente cambio de VERSION.
async function networkFirst(request) {
  try {
    const resp = await fetch(request);
    putInCache(request, resp);
    return resp;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

// Estáticos sin hash (logo, manifest, robots…): se sirve la copia cacheada y
// se refresca en segundo plano, así un cambio se ve en la siguiente carga sin
// tener que tocar VERSION.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(resp => {
    if (resp.status === 200) cache.put(request, resp.clone());
    return resp;
  });
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  return network;
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
  const url = new URL(e.request.url);

  if (url.hostname === 'api.jikan.moe') {
    e.respondWith(handleJikanRequest(e.request));
    return;
  }

  // Todo lo cross-origin que no sea Jikan pasa de largo: Supabase (incluidos
  // los websockets de realtime), las portadas de AniList/MAL y las tipografías
  // de Google. No es solo que no valga la pena cachearlas — el fetch() que
  // hace un Service Worker se evalúa contra connect-src, que solo lista los
  // hosts de API. Interceptarlas las hacía fallar por CSP (net::ERR_FAILED)
  // apenas la caché estaba vacía, como pasó con las portadas al mudar de
  // dominio; img-src y font-src permiten esos hosts, connect-src no.
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(handleNavigation(e.request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  e.respondWith(staleWhileRevalidate(e.request));
});
