import { cachedFetch } from '../utils/queryCache';
import { cleanCharacterBio } from '../utils/characterText';
import type { Anime, JikanResponse, Character, CharacterDetail } from '../types/anime';

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

// ── Personajes ─────────────────────────────────────────────────────────
// Única fuente de la sección de personajes (grilla de AnimeDetails y panel
// de detalle). Antes el primario era Jikan con MAL de respaldo, pero sus
// endpoints de personaje (/characters/{id}/full, /characters/{id}/pictures)
// devolvían 504 de forma sostenida, así que quedó solo MAL.
//
// Lo único que se pierde respecto de Jikan es el actor de voz: MAL no lo
// expone bajo ningún nombre de campo (probado contra la API en vivo). El
// resto —nombre, rol, favoritos, apodos, biografía y galería— sí está.

interface MalCharacterNode {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  alternative_name?: string | null;
  main_picture?: MalPicture;
  biography?: string | null;
  num_favorites?: number | null;
  pictures?: MalPicture[] | null;
}

interface MalCharacterListResponse {
  data: { node: MalCharacterNode; role?: string | null }[];
}

const malCharacterName = (node: MalCharacterNode) =>
  [node.first_name, node.last_name].filter(Boolean).join(' ').trim();

export const getAnimeCharactersMal = (malId: number): Promise<Character[]> =>
  cachedFetch(
    `mal:chars:${malId}`,
    async () => {
      const res = await malGet<MalCharacterListResponse>(`/characters?anime_id=${malId}`);
      return (res.data || []).map((entry): Character => {
        // Ojo: para personajes el CDN de MAL no tiene variante "l" (da 404),
        // a diferencia de las portadas de anime — no pasar esto por
        // getHighResImageUrl.
        const image = entry.node.main_picture?.large || entry.node.main_picture?.medium || '';
        return {
          character: {
            mal_id: entry.node.id,
            name: malCharacterName(entry.node),
            images: { jpg: { image_url: image, large_image_url: image } },
          },
          role: entry.role || 'Supporting',
          favorites: entry.node.num_favorites ?? 0,
        };
      });
    },
    30 * 60 * 1000,
    true,
  );

export const getCharacterDetailMal = (characterId: number): Promise<CharacterDetail | null> =>
  cachedFetch(
    `mal:char:${characterId}`,
    async () => {
      const node = await malGet<MalCharacterNode>(`/characters?id=${characterId}`);
      if (!node) return null;
      const portrait = node.main_picture?.large || node.main_picture?.medium;
      return {
        description: cleanCharacterBio(node.biography),
        nicknames: node.alternative_name
          ? node.alternative_name.split(',').map(n => n.trim()).filter(Boolean)
          : [],
        favorites: node.num_favorites ?? null,
        // `pictures` repite el retrato principal entre las alternativas.
        pictures: (node.pictures || [])
          .map(p => p.large || p.medium || '')
          .filter(url => url && url !== portrait),
      };
    },
    30 * 60 * 1000,
    true,
  );

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
