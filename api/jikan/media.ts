import { jikanFetch, sendJson, type JikanReq, type JikanRes } from '../_lib/jikan.js';

// GET /api/jikan/media?type=anime|manga&id=<n>   →   { url: string | null }
//
// Cover art for one title. MyAnimeList's key visuals have the title logo
// baked in and AniList's don't, which is the only reason this exists: the
// card renders immediately with whatever image it already has, and swaps in
// this one if it arrives. Nobody waits for it.
//
// Only the resolved URL is returned, never the image bytes — the browser
// still loads those straight from MAL's CDN. Sending a couple hundred bytes
// of JSON through the function keeps it cheap; proxying the image itself
// would put every cover on our bandwidth bill for no benefit.

const ALLOWED_TYPES = new Set(['anime', 'manga']);

// Cover art for a released title never changes, so a hit can be served from
// the edge forever. This is the whole point of the endpoint: the first
// visitor anywhere pays one Jikan request, everyone after that is free.
const CACHE_HIT = 'public, s-maxage=31536000, immutable';

// A failure, on the other hand, must NOT be cached for a year — Jikan being
// down for a minute would otherwise blank that cover until the heat death of
// the CDN. Short window, and the client treats it as "keep what you have".
const CACHE_MISS = 'public, s-maxage=60';

interface JikanMediaResponse {
  data?: { images?: { jpg?: { image_url?: string; large_image_url?: string } } };
}

/**
 * MAL's CDN encodes the size in the filename suffix: 'l' = large, 't' = tiny,
 * none = standard. Normalising here rather than in the browser means the
 * cached answer is already final. Mirrors getHighResImageUrl in
 * src/utils/animeUtils.ts, which stays where it is because it also runs on
 * AniList and MAL-API urls that never pass through this endpoint.
 */
const toLargeUrl = (url?: string): string => {
  if (!url) return '';
  if (!url.includes('cdn.myanimelist.net')) return url;
  return url.replace(/(?:[lt])?\.(jpg|webp)$/i, 'l.$1');
};

export default async function handler(req: JikanReq, res: JikanRes) {
  const url = new URL(req.url || '', 'http://internal');
  const type = url.searchParams.get('type') || 'anime';
  const id = url.searchParams.get('id');

  if (!ALLOWED_TYPES.has(type) || !id || !/^\d+$/.test(id)) {
    sendJson(res, 400, { error: 'type o id inválido' }, 'no-store');
    return;
  }

  try {
    // Si el circuit breaker está abierto (ver api/_lib/jikan.ts), esto tira
    // JikanUnavailableError sin tocar la red y cae en el catch de abajo: se
    // responde "sin portada" al instante y con caché corto, así que el
    // endpoint sigue siendo rápido mientras Jikan esté caído.
    const jikanRes = await jikanFetch(`/${type}/${id}`);
    if (!jikanRes.ok) {
      sendJson(res, 200, { url: null }, CACHE_MISS);
      return;
    }

    const json = (await jikanRes.json()) as JikanMediaResponse;
    const raw = json.data?.images?.jpg?.large_image_url || json.data?.images?.jpg?.image_url;
    const resolved = toLargeUrl(raw);

    // 200 either way: "this title has no cover" is a legitimate answer, not an
    // error, and the caller does the same thing with it in both cases.
    sendJson(res, 200, { url: resolved || null }, resolved ? CACHE_HIT : CACHE_MISS);
  } catch {
    sendJson(res, 200, { url: null }, CACHE_MISS);
  }
}
