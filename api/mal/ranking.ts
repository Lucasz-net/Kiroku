import { proxyJson, type MalReq, type MalRes } from '../_lib/mal.js';

// GET /api/mal/ranking?ranking_type=all|bypopularity&limit=25&offset=0
// Backs Home's "Top Rated"/"Top Popular" and the full Ranking page — see
// src/services/malApi.ts for the client-side shape this feeds into.
const ALLOWED_TYPES = new Set(['all', 'bypopularity']);
const FIELDS = 'mean,popularity,num_episodes,genres,main_picture,start_date';

export default async function handler(req: MalReq, res: MalRes) {
  const url = new URL(req.url || '', 'http://internal');
  const type = url.searchParams.get('ranking_type') || 'all';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  if (!ALLOWED_TYPES.has(type)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'ranking_type inválido' }));
    return;
  }

  // Cached at the CDN edge for every visitor (not just per-browser), so a
  // single MAL request serves everyone hitting Home/Ranking within the
  // window — this, not the in-memory queue, is what keeps request volume
  // to MAL low under real traffic.
  await proxyJson(
    res,
    `/anime/ranking?ranking_type=${type}&limit=${limit}&offset=${offset}&fields=${FIELDS}`,
    'public, s-maxage=900, stale-while-revalidate=1800',
  );
}
