// Shared MyAnimeList v2 API client for the serverless proxy endpoints under
// /api/mal/*. Not itself a route — Vercel skips files/folders under /api
// prefixed with "_".
//
// Why a proxy at all: the official MAL API sends no
// Access-Control-Allow-Origin header, so the browser can never call it
// directly (verified against the public docs/spec) — every request has to
// go through a backend. It also requires the app's Client ID on every
// request, which must never ship in the client bundle, so this is also
// where that secret stays server-side only.

const MAL_BASE = 'https://api.myanimelist.net/v2';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// MAL doesn't publish a hard rate limit, but community-documented practice
// is to stay near ~1 request/second to avoid 429s. Mirrors the single-lane
// throttled queue already used for Jikan (src/services/jikanApi.ts) so
// concurrent ranking/anime lookups from different visitors funnel through
// one paced lane instead of bursting. This is best-effort: serverless
// instances are ephemeral, so it only coordinates requests landing on the
// same warm instance — the real overload guard is the Cache-Control header
// each handler sets, which lets Vercel's CDN serve repeat requests without
// ever reaching MAL at all.
const MIN_GAP_MS = 350;
let queue: Promise<void> = Promise.resolve();
let cooldownUntil = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) await sleep(wait);
    return task();
  });
  queue = result.then(() => undefined, () => undefined).then(() => sleep(MIN_GAP_MS));
  return result;
}

async function fetchWithRetry(url: string): Promise<Response> {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) throw new Error('MAL_CLIENT_ID no está configurado en las variables de entorno');

  const RETRY_DELAYS = [500, 1200];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId } });
    if (res.status === 429) {
      cooldownUntil = Date.now() + 2000;
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    if (res.status >= 500) {
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    return res;
  }
}

export function malFetch(path: string): Promise<Response> {
  return enqueue(() => fetchWithRetry(`${MAL_BASE}${path}`));
}

// Minimal Node-request/response shape both the Vercel serverless runtime and
// the Vite dev-server middleware (vite.config.ts) satisfy, so each handler
// works unchanged in both environments without depending on @vercel/node.
export interface MalReq { url?: string }
export interface MalRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export async function proxyJson(res: MalRes, malPath: string, cacheControl?: string) {
  try {
    const malRes = await malFetch(malPath);
    const body = await malRes.text();
    res.statusCode = malRes.status;
    res.setHeader('Content-Type', 'application/json');
    if (malRes.ok && cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'MAL proxy error' }));
  }
}
