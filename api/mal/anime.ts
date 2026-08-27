import { proxyJson, type MalReq, type MalRes } from '../_lib/mal.js';

// GET /api/mal/anime?id=<malId>
// Single-title rank/score/popularity lookup, used by AnimeDetails to patch
// those three fields with MyAnimeList's own numbers regardless of whether
// the details page itself loaded from AniList or Jikan.
const FIELDS = 'mean,rank,popularity';

export default async function handler(req: MalReq, res: MalRes) {
  const url = new URL(req.url || '', 'http://internal');
  const id = url.searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'id inválido' }));
    return;
  }

  await proxyJson(
    res,
    `/anime/${id}?fields=${FIELDS}`,
    'public, s-maxage=1800, stale-while-revalidate=3600',
  );
}
