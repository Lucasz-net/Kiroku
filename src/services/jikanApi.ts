import { cachedFetch } from '../utils/queryCache';
import type { JikanFullResponse } from '../types/anime';

const BASE_URL = 'https://api.jikan.moe/v4';

// Thrown when a Jikan request fails, carrying the HTTP status so callers
// can distinguish a real 404 (not found) from rate limits / network errors.
export class JikanError extends Error {
  status: number;
  constructor(status: number) {
    super(`Jikan request failed with status ${status}`);
    this.name = 'JikanError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Jikan's public API has essentially no tolerance for concurrent bursts —
// a single anime-details page fires 3 requests at once (full data,
// characters, streaming) and Home fires 3 more (upcoming, top-rated,
// top-popular). Verified against the live API: 3 of 5 simultaneous requests
// came back 429, with no Retry-After header. Left uncoordinated, each of
// those requests retries on its own schedule and they keep re-colliding.
// Routing every call through this single-lane queue means the app only ever
// has one Jikan request in flight, paced to stay under the rate limit, so
// bursts turn into a short queue instead of a wall of 429s.
const MIN_GAP_MS = 380;
let queue: Promise<void> = Promise.resolve();
let cooldownUntil = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) await sleep(wait);
    return task();
  });
  // Keep the queue alive regardless of outcome, paced by MIN_GAP_MS so the
  // *next* request never lands right on top of this one.
  queue = result.then(() => undefined, () => undefined).then(() => sleep(MIN_GAP_MS));
  return result;
}

/** Jitter de ±25%: si algo falla para varias peticiones a la vez, no tiene
 *  sentido que todas reintenten en el mismo milisegundo. */
const jitter = (ms: number) => ms * (0.75 + Math.random() * 0.5);

// Two retries beyond the first attempt. 429 also pauses the whole queue
// briefly — 5xx (e.g. the "Jikan failed to connect to MyAnimeList" 504 seen
// in practice) only backs off the individual request. Jikan sends no
// Retry-After, but se respeta si algún día aparece: un valor del servidor
// siempre le gana a nuestra adivinanza.
async function fetchWithRetry(url: string): Promise<Response> {
  const RETRY_DELAYS = [600, 1400];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    const retryAfter = Number(res.headers.get('Retry-After')) * 1000;

    if (res.status === 429) {
      const wait = retryAfter > 0 ? retryAfter : 1500;
      cooldownUntil = Date.now() + wait;
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(jitter(wait));
      continue;
    }
    if (res.status >= 500) {
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(jitter(retryAfter > 0 ? retryAfter : RETRY_DELAYS[attempt]));
      continue;
    }
    return res;
  }
}

// ── Circuit breaker ────────────────────────────────────────────────────────
//
// Reintentar está bien cuando el problema es un hipo puntual. Cuando Jikan
// está caído de verdad, cada petición se multiplica por tres y la app pasa a
// golpear una API muerta durante todo el rato que el usuario siga navegando
// — que es exactamente lo que nos señaló un usuario mirando la pestaña de
// red. El breaker corta eso: después de FAILURE_THRESHOLD fallos seguidos
// deja de intentar por OPEN_MS y las llamadas fallan al instante, sin red.
//
// Fallar rápido acá casi nunca se ve en pantalla, porque todo lo que pasa
// por Jikan es opcional o tiene otra fuente: `cachedFetch` devuelve la copia
// vieja si la tiene (stale-while-error), la ficha ya se cargó por AniList y
// la portada se queda con la de AniList.
//
// Al vencer la ventana NO se reabre todo de golpe: pasa una sola petición de
// prueba (half-open). Si anda, se cierra el breaker; si no, se abre otra vez.
// Sin eso, al minuto siguiente entrarían 40 peticiones juntas contra una API
// que sigue caída.
const FAILURE_THRESHOLD = 4;
const OPEN_MS = 5 * 60 * 1000;

let consecutiveFailures = 0;
let openUntil = 0;
let probeInFlight = false;

function onSuccess() {
  consecutiveFailures = 0;
  openUntil = 0;
  probeInFlight = false;
}

function onFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) openUntil = Date.now() + OPEN_MS;
  probeInFlight = false;
}

/** Solo para los tests y para diagnóstico manual desde la consola. */
export const jikanCircuitState = () => ({
  open: Date.now() < openUntil,
  consecutiveFailures,
  msUntilRetry: Math.max(0, openUntil - Date.now()),
});

export function resetJikanCircuit() { onSuccess(); }

function jikanFetch(url: string): Promise<Response> {
  return enqueue(() => fetchWithRetry(url));
}

async function jikanGet<T>(url: string): Promise<T> {
  if (Date.now() < openUntil) throw new JikanError(503);

  // Ventana vencida pero el breaker todavía no se cerró: deja pasar una sola
  // prueba y el resto sigue fallando rápido hasta saber cómo le fue.
  const isProbe = consecutiveFailures >= FAILURE_THRESHOLD;
  if (isProbe) {
    if (probeInFlight) throw new JikanError(503);
    probeInFlight = true;
  }

  let res: Response;
  try {
    res = await jikanFetch(url);
  } catch (err) {
    // Se cayó la red o la petición se abortó: cuenta como fallo igual.
    onFailure();
    throw err;
  }

  if (!res.ok) {
    // Un 404 es una respuesta correcta a una pregunta mal hecha: el anime no
    // existe. Eso no dice nada del estado de Jikan, así que no cuenta.
    if (res.status === 404) { onSuccess(); throw new JikanError(404); }
    onFailure();
    throw new JikanError(res.status);
  }

  onSuccess();
  return res.json() as Promise<T>;
}

/**
 * Cover art for one title, as a ready-to-use URL ('' when there is none).
 *
 * The only Jikan call the browser no longer makes itself: it goes to our own
 * serverless proxy (api/jikan/media.ts), which caches the answer at the edge
 * for every visitor at once. This was by far the heaviest use of Jikan in the
 * app — one request per card, so a search with 40 results queued 40 requests
 * and Home fired 20 more — and all of it for a cosmetic upgrade. Behind the
 * proxy the same anime costs one upstream request in total, not one per
 * visitor per hour.
 *
 * Cached here for a year as well: a released title's key visual never
 * changes, and this is a short string, so it is the cheapest thing in the app
 * to keep on disk.
 */
export const getCoverUrl = (type: 'anime' | 'manga', id: number): Promise<string> =>
  cachedFetch(
    `cover:${type}:${id}`,
    async () => {
      const res = await fetch(`/api/jikan/media?type=${type}&id=${id}`);
      if (!res.ok) throw new JikanError(res.status);
      const json = (await res.json()) as { url: string | null };

      // "Sin portada" NO se guarda: tiene que fallar para que `cachedFetch`
      // no lo persista. Un año es la vida útil de una portada, no la de un
      // 504 pasajero — y el proxy responde `url: null` tanto cuando Jikan se
      // cayó como cuando el título de verdad no tiene imagen. Guardar eso
      // dejaba a esa persona sin la portada de ese anime durante un año.
      // Detectado probando la ficha de Death Note justo con Jikan devolviendo
      // 504. Reintentar es barato: del lado del servidor esa respuesta está
      // cacheada 60 s y el circuit breaker la corta sin salir a la red.
      if (!json.url) throw new Error(`Sin portada para ${type} ${id}`);
      return json.url;
    },
    365 * 24 * 60 * 60 * 1000,
    true,
  );

export const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { year, season: 'winter', label: 'Invierno' };
  if (month <= 6) return { year, season: 'spring', label: 'Primavera' };
  if (month <= 9) return { year, season: 'summer', label: 'Verano' };
  return            { year, season: 'fall',   label: 'Otoño' };
};

// Persisted for a week: a finished anime's synopsis, episode count and
// studios don't change, and this used to live in memory only — so every F5
// re-fetched the same title from the API that fails the most. The week-long
// ceiling is there for the titles that *are* still moving (an airing show's
// episode count), not because the data goes stale on its own.
export const getAnimeById = (id: string): Promise<JikanFullResponse> =>
  cachedFetch(`anime:${id}`, () => jikanGet(`${BASE_URL}/anime/${id}/full`), 7 * 24 * 60 * 60 * 1000, true);

// Streaming platforms do change (a series lands on a new one), but not on an
// hourly cadence — a day is a reasonable compromise.
export const getAnimeStreaming = (id: string): Promise<{ data: { name: string; url: string }[] }> =>
  cachedFetch(
    `streaming:${id}`,
    () => jikanGet(`${BASE_URL}/anime/${id}/streaming`),
    24 * 60 * 60 * 1000,
    true,
  );

// Rank/popularity/score (Home, RankingPage, AnimeDetails badges) come from
// MyAnimeList's official API — see src/services/malApi.ts — not from here.
//
// Lo que queda de Jikan en el navegador es solo el camino de respaldo de la
// ficha (getAnimeById + getAnimeStreaming). Las búsquedas por texto y por
// estudio se hacen contra AniList (searchAniList / searchByStudio); las que
// vivían acá —`advancedSearchAnime` y `getAnimeByStudio`— quedaron sin un
// solo consumidor cuando se migró la búsqueda y se borraron. Si alguna vez
// hace falta filtrar por estudio combinando más filtros, el punto de partida
// es searchByStudio en aniListApi.ts, no revivir esto: el endpoint de
// búsqueda de Jikan venía devolviendo 504 de forma sostenida.

export const getSeasonLabel = (season: string): string => {
  const labels: Record<string, string> = { winter: 'Invierno', spring: 'Primavera', summer: 'Verano', fall: 'Otoño' };
  return labels[season] || season;
};
