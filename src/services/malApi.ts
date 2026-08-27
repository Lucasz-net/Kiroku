import { cachedFetch } from '../utils/queryCache';
import type { Anime, JikanResponse } from '../types/anime';

// Client for MyAnimeList's official API v2, reached through our own
// serverless proxy at /api/mal/* (see api/mal/ranking.ts, api/mal/anime.ts,
// api/_lib/mal.ts) — the real MAL API has no CORS headers, so the browser
// can never call it directly, and the Client ID it requires on every
// request must stay server-side. Used only where a rank/popularity/score
// number is shown (Home, RankingPage, AnimeDetails); anime details,
// characters, streaming, etc. are unrelated and keep using AniList/Jikan.

const BASE = '/api/mal';

export class MalError extends Error {
  status: number;
  constructor(status: number) {
    super(`MAL request failed with status ${status}`);
    this.name = 'MalError';
    this.status = status;
  }
}

interface MalPicture { medium?: string; large?: string }
interface MalGenre { id: number; name: string }

interface MalRankingNode {
  id: number;
  title: string;
  main_picture?: MalPicture;
  mean?: number | null;
  popularity?: number | null;
  num_episodes?: number | null;
  genres?: MalGenre[];
  start_date?: string;
}

interface MalRankingEntry {
  node: MalRankingNode;
  ranking: { rank: number };
}

interface MalRankingResponse {
  data: MalRankingEntry[];
  paging?: { next?: string };
}

interface MalAnimeNode {
  mean?: number | null;
  rank?: number | null;
  popularity?: number | null;
}

async function malGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new MalError(res.status);
  return res.json() as Promise<T>;
}

function mapRankingEntry(entry: MalRankingEntry): Anime {
  const node = entry.node;
  const image = node.main_picture?.large || node.main_picture?.medium || '';
  return {
    mal_id: node.id,
    title: node.title,
    episodes: node.num_episodes ?? null,
    score: node.mean ?? null,
    rank: entry.ranking?.rank ?? null,
    popularity: node.popularity ?? null,
    images: { jpg: { image_url: image, large_image_url: image } },
    aired: { from: node.start_date || '' },
    genres: (node.genres || []).map(g => ({ mal_id: g.id, name: g.name })),
  };
}

// MAL's own "Top Anime Series" (ranking_type=all, sorted by score) and
// "Most Popular" (ranking_type=bypopularity) — same split Jikan's
// /top/anime used, so this is a drop-in replacement for
// getTopRatedAnime/getTopPopularAnime from jikanApi.ts.
export const getTopAnime = (page = 1, filter?: 'bypopularity'): Promise<JikanResponse> => {
  const limit = 25;
  const offset = (page - 1) * limit;
  const type = filter === 'bypopularity' ? 'bypopularity' : 'all';

  return cachedFetch<JikanResponse>(
    `mal:top:${type}:${page}`,
    async () => {
      const res = await malGet<MalRankingResponse>(
        `/ranking?ranking_type=${type}&limit=${limit}&offset=${offset}`,
      );
      return {
        data: res.data.map(mapRankingEntry),
        pagination: {
          last_visible_page: 0,
          has_next_page: !!res.paging?.next,
          current_page: page,
        },
      };
    },
    15 * 60 * 1000,
    true,
  );
};

export const getTopRatedAnime = (page = 1) => getTopAnime(page);
export const getTopPopularAnime = (page = 1) => getTopAnime(page, 'bypopularity');

// Single-title rank/score/popularity lookup for AnimeDetails — patches
// those three fields with MyAnimeList's own numbers after the page's
// primary source (AniList or Jikan) has already loaded everything else.
export const getAnimeRanking = (
  malId: number,
): Promise<{ rank: number | null; popularity: number | null; score: number | null }> =>
  cachedFetch(
    `mal:anime:${malId}`,
    async () => {
      const node = await malGet<MalAnimeNode>(`/anime?id=${malId}`);
      return {
        rank: node.rank ?? null,
        popularity: node.popularity ?? null,
        score: node.mean ?? null,
      };
    },
    30 * 60 * 1000,
    true,
  );
