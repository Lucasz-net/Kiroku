// src/services/aniListApi.ts
import { cachedFetch } from '../utils/queryCache';
import type { Anime, AnimeFull, AnimeRelationEntry } from '../types/anime';

const ANILIST_URL = 'https://graphql.anilist.co';

export interface AniListFilters {
  q?: string;
  formats?: string[];
  status?: string;
  season?: string;
  seasonYear?: number;
  genres?: string[];
  page?: number;
  perPage?: number;
  sort?: string[];
}

interface AniListVariables {
  page: number;
  perPage: number;
  search?: string;
  status?: string;
  season?: string;
  seasonYear?: number;
  genres?: string[];
  formatIn?: string[];
  sort: string[];
}

interface AniListMedia {
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
  };
  episodes: number | null;
  averageScore: number | null;
  coverImage: {
    large: string | null;
  } | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  genres: string[] | null;
  status: string | null;
  format: string | null;
}

interface AniListResponse {
  data: {
    Page: {
      pageInfo: {
        hasNextPage: boolean;
      };
      media: AniListMedia[];
    };
  };
}

export const searchAniList = async (filters: AniListFilters) => {
  const query = `
    query (
      $page: Int,
      $perPage: Int,
      $search: String,
      $status: MediaStatus,
      $season: MediaSeason,
      $seasonYear: Int,
      $genres: [String],
      $formatIn: [MediaFormat],
      $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
        }
        media(
          search: $search,
          type: ANIME,
          status: $status,
          season: $season,
          seasonYear: $seasonYear,
          genre_in: $genres,
          format_in: $formatIn,
          sort: $sort,
          isAdult: false
        ) {
          idMal
          title {
            romaji
            english
          }
          episodes
          averageScore
          coverImage {
            large
          }
          startDate {
            year
            month
            day
          }
          genres
          status
          format
        }
      }
    }
  `;

  const variables: AniListVariables = {
    page: filters.page || 1,
    perPage: filters.perPage || 40,
    sort: filters.sort && filters.sort.length > 0 ? filters.sort : ['POPULARITY_DESC', 'SCORE_DESC'],
  };

  if (filters.q) variables.search = filters.q;
  if (filters.status) {
    if (filters.status === 'airing') variables.status = 'RELEASING';
    if (filters.status === 'complete') variables.status = 'FINISHED';
    if (filters.status === 'upcoming') variables.status = 'NOT_YET_RELEASED';
  }
  if (filters.season) variables.season = filters.season.toUpperCase();
  if (filters.seasonYear) variables.seasonYear = filters.seasonYear;
  if (filters.genres && filters.genres.length > 0) variables.genres = filters.genres;
  if (filters.formats && filters.formats.length > 0) variables.formatIn = filters.formats;

  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error('Error fetching from AniList');

  const json = (await response.json()) as AniListResponse;
  const pageData = json.data.Page;

  return {
    data: mapAniListMedia(pageData.media),
    hasNextPage: pageData.pageInfo.hasNextPage,
  };
};

// Compartido por la búsqueda general y por la búsqueda por estudio, que
// consultan endpoints distintos de AniList pero tienen que devolver
// exactamente la misma forma y aplicar los mismos descartes.
function mapAniListMedia(media: AniListMedia[]): Anime[] {
  return media
    .filter((m) => {
      // 1. Debe tener un ID válido de MyAnimeList/Jikan
      if (m.idMal === null) return false;

      // 2. Ocultar videos musicales promocionales ("Other" / "Music")
      if (m.format === 'MUSIC') return false;

      // 3. Si el anime ya finalizó, DEBE tener una calificación.
      // Esto elimina animes "fantasma" o especiales raros que no tienen score.
      if (m.status === 'FINISHED' && !m.averageScore) return false;

      return true;
    })
    .map((m): Anime => ({
      mal_id: m.idMal as number,
      title: m.title.romaji || m.title.english || 'Sin título',
      episodes: m.episodes || null,
      score: m.averageScore ? m.averageScore / 10 : null,
      images: {
        jpg: {
          image_url: m.coverImage?.large || '',
          large_image_url: m.coverImage?.large || '',
        },
      },
      aired: {
        from: m.startDate?.year
          ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, '0')}-${String(m.startDate.day || 1).padStart(2, '0')}`
          : '',
      },
      genres: (m.genres || []).map((g, i) => ({
        mal_id: i,
        name: g,
      })),
    }));
}

// ── Búsqueda por estudio ───────────────────────────────────────────────────
// `Page.media()` no tiene ningún argumento de estudio, así que el filtro de
// estudios de la búsqueda no llegaba nunca a la API: se guardaba en la URL,
// se mostraba el chip, y los resultados eran los mismos con o sin filtro.
//
// El camino que sí existe es `Studio.media`, que acepta orden y paginación
// pero no los demás filtros — esos se aplican sobre los resultados en
// Search.tsx. Se evaluó resolverlo con `producers=` de Jikan, que sí combina
// todo, pero su endpoint de búsqueda estaba devolviendo 504 de forma
// sostenida (6 de 6 intentos) mientras el de detalle respondía normal, así
// que colgar un filtro de la UI de ahí no era viable.

interface AniListStudioResponse {
  data: {
    Studio: {
      media: {
        pageInfo: { hasNextPage: boolean };
        nodes: AniListMedia[];
      };
    } | null;
  };
}

const STUDIO_QUERY = `
  query ($search: String, $page: Int, $perPage: Int, $sort: [MediaSort]) {
    Studio(search: $search) {
      media(sort: $sort, isMain: true, page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        nodes {
          idMal
          title { romaji english }
          episodes
          averageScore
          coverImage { large }
          startDate { year month day }
          genres
          status
          format
        }
      }
    }
  }
`;

/**
 * Filtros que `Studio.media` no acepta y por eso se aplican sobre lo que
 * devuelve. Se hace acá y no en la página para que los campos crudos de
 * AniList (`format`, `status`) no tengan que filtrarse al tipo `Anime`, que
 * usa etiquetas distintas.
 */
export interface StudioClientFilters {
  /** Nombres de género de AniList, ya traducidos. */
  genres?: string[];
  /** Formatos de AniList: TV, MOVIE, OVA, SPECIAL, ONA. */
  formats?: string[];
  /** airing | complete | upcoming, igual que el resto de la búsqueda. */
  status?: string;
  year?: number;
}

const STATUS_FILTER: Record<string, string> = {
  airing: 'RELEASING',
  complete: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
};

export const searchByStudio = async (
  studioName: string,
  page = 1,
  sort: string[] = ['POPULARITY_DESC'],
  filters: StudioClientFilters = {},
): Promise<{ data: Anime[]; hasNextPage: boolean }> => {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      query: STUDIO_QUERY,
      // 25 y no 50: AniList topa la paginación de `Studio.media` ahí, así que
      // pedir más solo hace creer que la página trae el doble de lo que trae.
      variables: { search: studioName, page, perPage: 25, sort },
    }),
  });
  if (!response.ok) throw new Error('Error fetching from AniList');

  const json = (await response.json()) as AniListStudioResponse;
  const media = json.data?.Studio?.media;
  if (!media) return { data: [], hasNextPage: false };

  const wantedStatus = filters.status ? STATUS_FILTER[filters.status] : undefined;

  const filtered = media.nodes.filter(m => {
    if (filters.formats?.length && !filters.formats.includes(m.format ?? '')) return false;
    if (wantedStatus && m.status !== wantedStatus) return false;
    if (filters.year && m.startDate?.year !== filters.year) return false;
    if (filters.genres?.length) {
      const has = filters.genres.every(g => (m.genres || []).includes(g));
      if (!has) return false;
    }
    return true;
  });

  return {
    data: mapAniListMedia(filtered),
    hasNextPage: media.pageInfo.hasNextPage,
  };
};

// Backing pool for "random anime" / "recommended for you" only — the actual
// Top Rated / Top Popular rankings shown to users come from MyAnimeList's
// official API (see getTopRatedAnime/getTopPopularAnime in malApi.ts), so
// the rank numbers always match MyAnimeList. This just needs a decent pool
// of well-scored titles to sample from, so AniList's own sort is fine here.
const cachedTop = (sort: string[], page: number) =>
  cachedFetch(
    `anilist:top:${sort.join(',')}:${page}`,
    () => searchAniList({ page, perPage: 25, sort }),
    15 * 60 * 1000,
    true,
  );

// "Random anime" / "recommended for you" — previously hit Jikan's `/top/anime`
// (the endpoint that was failing most often); draws from this AniList pool
// instead of the Jikan-backed ranking pages.
export const getRandomAnime = async (): Promise<{ data: Anime }> => {
  const randomPage = Math.floor(Math.random() * 15) + 1;
  const res = await cachedTop(['SCORE_DESC'], randomPage);
  const filtered = res.data.filter(a => a.score && a.score > 7);
  return { data: filtered[Math.floor(Math.random() * filtered.length)] };
};

export const getRecommendedAnimes = async (): Promise<{ data: Anime[] }> => {
  const randomPage = Math.floor(Math.random() * 15) + 1;
  const res = await cachedTop(['SCORE_DESC'], randomPage);
  const filtered = res.data.filter(a => a.score && a.score > 7);
  return { data: filtered.sort(() => 0.5 - Math.random()).slice(0, 6) };
};

// ── Seasonal browsing (Home "Estrenos" + SeasonalPage) ─────────────────────
// Replaces Jikan's `/seasons/{year}/{season}` — same underlying filter
// AniList already supports for Search, just parameterized for season browsing.
export const getSeasonAniList = (year: number, season: string, page = 1, formats?: string[]) =>
  cachedFetch(
    `anilist:season:${year}:${season}:${page}:${formats?.join(',') ?? ''}`,
    () => searchAniList({ season, seasonYear: year, page, perPage: 40, formats, sort: ['POPULARITY_DESC', 'SCORE_DESC'] }),
    10 * 60 * 1000,
    true,
  );

// ── Full anime details (info + characters + relations + trailer + streaming) ──
// One GraphQL query replaces Jikan's three separate REST calls
// (/full, /characters, /streaming), looked up by MAL id so the rest of the
// app (routes, saved_animes rows) keeps working unchanged.

interface AniListMediaFull {
  idMal: number | null;
  title: { romaji: string | null; english: string | null };
  format: string | null;
  episodes: number | null;
  duration: number | null;
  status: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  averageScore: number | null;
  genres: string[] | null;
  studios: { nodes: { id: number; name: string }[] } | null;
  description: string | null;
  coverImage: { large: string | null; extraLarge: string | null } | null;
  trailer: { id: string | null; site: string | null } | null;
  relations: {
    edges: {
      relationType: string;
      node: { idMal: number | null; type: string; title: { romaji: string | null; english: string | null }; format: string | null };
    }[];
  } | null;
  streamingEpisodes: { site: string | null; url: string | null }[] | null;
}

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special', MUSIC: 'Music',
};

const STATUS_LABELS: Record<string, string> = {
  RELEASING: 'Currently Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  FINISHED: 'Finished Airing',
  CANCELLED: 'Finished Airing',
  HIATUS: 'Finished Airing',
};

const titleCaseRelation = (relationType: string) =>
  relationType.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

// Los personajes ya no salen de acá: la sección de personajes usa la API
// oficial de MAL (ver getAnimeCharactersMal en malApi.ts), que devuelve
// ids de personaje de MyAnimeList — los mismos que guarda el perfil.
export interface AniListAnimeBundle {
  anime: AnimeFull;
  streaming: { name: string; url: string }[];
}

function mapAniListFull(media: AniListMediaFull): AniListAnimeBundle | null {
  if (!media.idMal) return null;

  const relGroups = new Map<string, AnimeRelationEntry[]>();
  (media.relations?.edges || []).forEach(edge => {
    if (!edge.node.idMal) return;
    const label = titleCaseRelation(edge.relationType);
    const entry: AnimeRelationEntry = {
      mal_id: edge.node.idMal,
      type: edge.node.type.toLowerCase(),
      name: edge.node.title.romaji || edge.node.title.english || '',
    };
    if (!relGroups.has(label)) relGroups.set(label, []);
    relGroups.get(label)!.push(entry);
  });

  const anime: AnimeFull = {
    mal_id: media.idMal,
    title: media.title.romaji || media.title.english || 'Sin título',
    title_english: media.title.english,
    type: media.format ? FORMAT_LABELS[media.format] || media.format : undefined,
    episodes: media.episodes,
    score: media.averageScore ? media.averageScore / 10 : null,
    synopsis: (media.description || 'Sinopsis no disponible en la base de datos.').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''),
    duration: media.duration ? `${media.duration} min per ep` : undefined,
    // Rank/popularity/score always come from MyAnimeList's official API (see
    // getAnimeRanking in malApi.ts), never from AniList's own numbers —
    // mixing sources produced duplicate "#1" badges and mismatched scores
    // depending on which source happened to answer for a given title.
    // Filled in by AnimeDetails after this bundle loads.
    rank: null,
    popularity: null,
    images: {
      jpg: {
        image_url: media.coverImage?.large || '',
        large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || '',
      },
    },
    aired: {
      from: media.startDate?.year
        ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}`
        : '',
    },
    year: media.seasonYear ?? (media.startDate?.year ?? null),
    status: media.status ? STATUS_LABELS[media.status] || media.status : 'Finished Airing',
    studios: (media.studios?.nodes || []).map(s => ({ mal_id: s.id, name: s.name })),
    genres: (media.genres || []).map((g, i) => ({ mal_id: i, name: g })),
    trailer: media.trailer?.site === 'youtube' && media.trailer.id
      ? {
          youtube_id: media.trailer.id,
          url: `https://www.youtube.com/watch?v=${media.trailer.id}`,
          embed_url: `https://www.youtube.com/embed/${media.trailer.id}`,
        }
      : undefined,
    relations: Array.from(relGroups, ([relation, entry]) => ({ relation, entry })),
  };

  const seenSites = new Set<string>();
  const streaming = (media.streamingEpisodes || [])
    .filter((ep): ep is { site: string; url: string } => !!ep.site && !!ep.url && !seenSites.has(ep.site) && (seenSites.add(ep.site), true))
    .map(ep => ({ name: ep.site, url: ep.url }));

  return { anime, streaming };
}

const ANIME_FULL_QUERY = `
  query ($id: Int) {
    Media(idMal: $id, type: ANIME) {
      idMal
      title { romaji english }
      format
      episodes
      duration
      status
      seasonYear
      startDate { year month day }
      averageScore
      genres
      studios(isMain: true) { nodes { id name } }
      description(asHtml: false)
      coverImage { large extraLarge }
      trailer { id site }
      relations {
        edges {
          relationType
          node { idMal type title { romaji english } format }
        }
      }
      streamingEpisodes { site url }
    }
  }
`;

export const getAnimeFullByMalId = (malId: number): Promise<AniListAnimeBundle | null> =>
  cachedFetch(
    `anilist:full:${malId}`,
    async () => {
      const response = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: ANIME_FULL_QUERY, variables: { id: malId } }),
      });
      if (!response.ok) throw new Error('Error fetching from AniList');
      const json = (await response.json()) as { data: { Media: AniListMediaFull | null } };
      const media = json.data?.Media;
      return media ? mapAniListFull(media) : null;
    },
    30 * 60 * 1000,
    true,
  );
