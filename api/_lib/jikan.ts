// Shared Jikan client for the serverless proxy endpoints under /api/jikan/*.
// Not itself a route — Vercel skips files/folders under /api prefixed with "_".
//
// Why a proxy for an API that *does* send CORS headers (unlike MAL, see
// api/_lib/mal.ts): request volume. Cover art was resolved one Jikan request
// per card, straight from each visitor's browser — a search with 40 results
// fired up to 40 requests, and the Home rankings fired 20 more. Multiply that
// by every visitor and Jikan sees an unbounded number of uncoordinated
// clients hammering it for the same handful of popular titles, with each
// browser's cache helping only that one browser.
//
// Routed through here instead, the answer is cached at Vercel's edge, so a
// given anime costs *one* upstream request for every visitor in the world,
// essentially forever (cover art never changes). Jikan also stops seeing N
// browsers and starts seeing one client it can identify and that paces
// itself.

const JIKAN_BASE = 'https://api.jikan.moe/v4';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Same single-lane queue as the browser-side client and the MAL proxy: Jikan
// has no tolerance for concurrent bursts (verified: 3 of 5 simultaneous
// requests came back 429, with no Retry-After header). Best-effort, since
// serverless instances are ephemeral — the real volume control is the
// Cache-Control header each handler sets.
const MIN_GAP_MS = 380;
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

/**
 * One retry, not the browser client's two.
 *
 * Everything this proxy serves is *optional* data — a cover upgrade that the
 * page already rendered without. Retrying hard on behalf of something nobody
 * is waiting for is exactly how a Jikan outage turned into us hammering them:
 * every failing request used to multiply itself by three. A miss here just
 * means the visitor keeps the AniList cover, which is a perfectly good image.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Kiroku/1.0 (+https://kiroku.pro)' },
    });
    const retryAfter = Number(res.headers.get('Retry-After')) * 1000;

    if (res.status === 429) {
      // Jikan sends no Retry-After, so a fixed cooldown on the whole lane is
      // the only signal available — but honour the header if it ever appears.
      cooldownUntil = Date.now() + (retryAfter > 0 ? retryAfter : 2000);
      return res;
    }
    if (res.status >= 500 && attempt === 0) {
      await sleep(retryAfter > 0 ? retryAfter : 700);
      continue;
    }
    return res;
  }
}

// ── Circuit breaker ────────────────────────────────────────────────────────
//
// Same idea as the one in src/services/jikanApi.ts, duplicated rather than
// shared because api/ is bundled separately from src/ — the queue above is
// duplicated from api/_lib/mal.ts for the same reason.
//
// It matters more here than in the browser: a warm serverless instance can
// serve a lot of cover lookups, and with Jikan down every one of them would
// otherwise wait out a full request plus a retry before answering "no cover".
// Failing instantly makes the endpoint stay fast during an outage instead of
// turning into a queue of doomed requests — and, since covers are optional,
// the visitor sees no difference either way.
//
// Best-effort by nature: the state lives in one instance's memory, so several
// warm instances each keep their own. That is fine — the point is to stop one
// instance from looping on a dead API, not to coordinate a fleet.
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 2 * 60 * 1000;

let consecutiveFailures = 0;
let openUntil = 0;
let probeInFlight = false;

export class JikanUnavailableError extends Error {
  constructor() {
    super('Jikan circuit open');
    this.name = 'JikanUnavailableError';
  }
}

export async function jikanFetch(path: string): Promise<Response> {
  if (Date.now() < openUntil) throw new JikanUnavailableError();

  // Window elapsed but still failing: let exactly one request through to
  // check, and keep failing the rest fast until it reports back.
  const isProbe = consecutiveFailures >= FAILURE_THRESHOLD;
  if (isProbe) {
    if (probeInFlight) throw new JikanUnavailableError();
    probeInFlight = true;
  }

  let res: Response;
  try {
    res = await enqueue(() => fetchWithRetry(`${JIKAN_BASE}${path}`));
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD) openUntil = Date.now() + OPEN_MS;
    probeInFlight = false;
    throw err;
  }

  // A 404 answers the question correctly (that id has no entry) and says
  // nothing about Jikan's health, so it counts as a success for the breaker.
  if (res.ok || res.status === 404) {
    consecutiveFailures = 0;
    openUntil = 0;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD) openUntil = Date.now() + OPEN_MS;
  }
  probeInFlight = false;

  return res;
}

// Minimal Node-request/response shape both the Vercel serverless runtime and
// the Vite dev-server middleware (vite.config.ts) satisfy, so each handler
// works unchanged in both environments without depending on @vercel/node.
export interface JikanReq { url?: string }
export interface JikanRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export function sendJson(res: JikanRes, status: number, body: unknown, cacheControl: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(body));
}
