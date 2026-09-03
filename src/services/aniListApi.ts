// src/services/aniListApi.ts
import { cachedFetch } from '../utils/queryCache';
import type { Anime, AnimeFull, AnimeRelationEntry } from '../types/anime';

// Exportado para `aniListImport.ts`, que consulta el mismo endpoint pero es
// un flujo aparte (la lista de un usuario, no el catálogo).
export const ANILIST_URL = 'https://graphql.anilist.co';

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
        total: number | null;
      };
      media: AniListMedia[];
    };
  };
}

/**
 * AniList deja de contar en 5000.
 *
 * `pageInfo.total` parece la solución obvia para mostrar cuántos resultados
 * tiene una búsqueda, pero **solo es un número real cuando todo entra en una
 * página**. En cuanto hay más de una, devuelve siempre exactamente 5000, con
 * `lastPage` = 5000/perPage. Comprobado contra la API en vivo (2026-09-03):
 *
 *   buscar "naruto"        → total 9…26, hasNextPage false   ← real
 *   año 2002 + terror      → total 7                          ← real
 *   año 2002               → total 5000, lastPage 125         ← centinela
 *   año 2002 + solo TV     → total 5000                       ← el mismo, y
 *                                                               filtrar más
 *                                                               debería dar
 *                                                               menos
 *   buscar "school"        → total 5000 con perPage 5, 40…    ← centinela
 *
 * Peor todavía: pidiendo una página vacía lejana, `total` pasa a valer
 * `(página-1) × perPage` — o sea que el número cambia según qué página pidas.
 * No es un total, es relleno.
 *
 * Por eso el centinela se traduce a `null` acá: la UI prefiere no mostrar
 * número antes que mostrar uno inventado. NO reemplazar esto por
 * `pageInfo.total` a secas por más razonable que suene.
 */
const ANILIST_TOTAL_SENTINEL = 5000;

/**
 * Resultado de una búsqueda paginada.
 *
 * `total` es la cantidad real de coincidencias, o `null` cuando AniList no la
 * sabe (ver arriba) o cuando el camino usado no puede saberla (ver
 * `searchByStudio`, que filtra del lado del cliente). Existe porque la
 * pantalla mostraba "Resultados 40" —que es cuántos se cargaron, no cuántos
 * hay— y un usuario filtró por 2002, vio 40 y escribió que era imposible que
 * ese año hubieran salido exactamente 40 series. Tenía razón.
 */
export interface AniListSearchResult {
  data: Anime[];
  hasNextPage: boolean;
  total: number | null;
}

export const searchAniList = async (
  filters: AniListFilters,
  signal?: AbortSignal,
): Promise<AniListSearchResult> => {
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
          total
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
    // Lo usa el buscador instantáneo para cancelar la consulta anterior
    // cuando la persona sigue tecleando. Ver Search.tsx.
    signal,
  });

  if (!response.ok) throw new Error('Error fetching from AniList');

  const json = (await response.json()) as AniListResponse;
  const pageData = json.data.Page;

  return {
    data: mapAniListMedia(pageData.media),
    hasNextPage: pageData.pageInfo.hasNextPage,
    // El centinela 5000 significa "no lo sé" (ver ANILIST_TOTAL_SENTINEL).
    // Cuando sí es real, es el total de coincidencias de AniList y no la
    // cantidad exacta de tarjetas que se dibujan: mapAniListMedia descarta
    // algunas (sin id de MAL, videos musicales, terminados sin nota).
    total: pageData.pageInfo.total != null && pageData.pageInfo.total < ANILIST_TOTAL_SENTINEL
      ? pageData.pageInfo.total
      : null,
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
): Promise<AniListSearchResult> => {
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
  if (!media) return { data: [], hasNextPage: false, total: null };

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
    // Sin total a propósito: género, formato, estado y año se filtran acá
    // arriba, sobre lo que ya vino, así que cualquier número que devolviera
    // AniList sería el del estudio entero y no el de la búsqueda que la
    // persona hizo. Mejor no mostrar total que mostrar uno falso.
    total: null,
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

// ── Calendario de emisión ──────────────────────────────────────────────────
// "El episodio 8 sale el jueves" es la razón por la que alguien abre un
// tracker de anime todos los días, y hasta ahora la app no lo decía en
// ningún lado. AniList ya expone `nextAiringEpisode` con la fecha exacta, y
// `idMal_in` permite pedir todos los animes en emisión de la lista de una
// sola consulta en vez de una por título.

export interface AiringEntry {
  mal_id: number;
  title: string;
  image_url: string;
  episode: number;
  /** Momento exacto de emisión, en milisegundos. */
  airingAt: number;
}

interface AniListAiringResponse {
  data: {
    Page: {
      media: {
        idMal: number | null;
        title: { romaji: string | null; english: string | null };
        coverImage: { large: string | null } | null;
        nextAiringEpisode: { episode: number; airingAt: number } | null;
      }[];
    };
  };
}

const AIRING_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(idMal_in: $ids, type: ANIME, status: RELEASING) {
        idMal
        title { romaji english }
        coverImage { large }
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`;

export const getAiringSchedule = async (malIds: number[]): Promise<AiringEntry[]> => {
  if (malIds.length === 0) return [];

  // AniList tope la página en 50; con listas grandes se pide de a tandas.
  const chunks: number[][] = [];
  for (let i = 0; i < malIds.length; i += 50) chunks.push(malIds.slice(i, i + 50));

  const results = await Promise.all(chunks.map(async ids => {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { ids } }),
    });
    if (!response.ok) return [];
    const json = (await response.json()) as AniListAiringResponse;
    return json.data?.Page?.media ?? [];
  }));

  return results
    .flat()
    .filter(m => m.idMal && m.nextAiringEpisode)
    .map((m): AiringEntry => ({
      mal_id: m.idMal as number,
      title: m.title.romaji || m.title.english || 'Sin título',
      image_url: m.coverImage?.large || '',
      episode: m.nextAiringEpisode!.episode,
      airingAt: m.nextAiringEpisode!.airingAt * 1000,
    }))
    .sort((a, b) => a.airingAt - b.airingAt);
};

export interface RecommendationInput {
  /** Géneros más frecuentes en la lista del usuario, en nombres de AniList. */
  genres?: string[];
  /** Ids que ya tiene guardados: no tiene sentido recomendárselos. */
  excludeMalIds?: number[];
}

/**
 * Recomendaciones.
 *
 * Antes tomaba una página al azar de AniList con puntuación mayor a 7 y la
 * barajaba: el resultado era idéntico para todo el mundo y no miraba la lista
 * de nadie. Ahora, si el usuario tiene animes guardados, se consulta por sus
 * géneros más frecuentes y se descarta lo que ya tiene. Sin lista guardada
 * (visitante sin cuenta o cuenta nueva) se cae al pozo genérico de siempre,
 * que para descubrir sigue estando bien.
 */
export const getRecommendedAnimes = async (
  input: RecommendationInput = {},
): Promise<{ data: Anime[]; personalized: boolean }> => {
  const { genres = [], excludeMalIds = [] } = input;
  const exclude = new Set(excludeMalIds);
  const pick = (list: Anime[]) =>
    list
      .filter(a => a.score && a.score > 7 && !exclude.has(a.mal_id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 6);

  if (genres.length > 0) {
    // Hasta 3 géneros: con más, AniList exige que los cumplan todos y el
    // resultado se vacía. Se rota la página para que no sea siempre lo mismo.
    const topGenres = genres.slice(0, 3);
    const page = Math.floor(Math.random() * 3) + 1;
    const res = await cachedFetch(
      `anilist:recs:${topGenres.join(',')}:${page}`,
      () => searchAniList({ genres: topGenres, page, perPage: 50, sort: ['POPULARITY_DESC'] }),
      15 * 60 * 1000,
      true,
    );
    const personalized = pick(res.data);
    if (personalized.length > 0) return { data: personalized, personalized: true };
    // Sin resultados utilizables (géneros muy raros, o ya lo vio todo):
    // mejor mostrar algo genérico que una sección vacía.
  }

  const randomPage = Math.floor(Math.random() * 15) + 1;
  const res = await cachedTop(['SCORE_DESC'], randomPage);
  return { data: pick(res.data), personalized: false };
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
    // Una semana en disco. La ficha de un anime terminado no cambia, y hasta
    // ahora vivía 30 minutos: volver a abrir el mismo anime al día siguiente
    // era una consulta nueva a AniList por cada visita.
    7 * 24 * 60 * 60 * 1000,
    true,
  );

// ── Resumen en lote para completar importaciones de MAL ────────────────────
// El "completar datos" de una lista importada llamaba a getAnimeFullByMalId
// una vez por anime (una consulta GraphQL cada una), respetando la pausa de
// 2.1 s que exige el límite de AniList — con una lista de 500 animes eso son
// más de 17 minutos, así que casi nadie lo terminaba y géneros/estudios
// quedaban vacíos para siempre. `Page.media(idMal_in: ...)` devuelve hasta 50
// animes en una sola consulta, así que la misma lista se resuelve en ~10
// consultas en vez de 500: la portada, el género y el estudio se completan
// en segundos y ya no dependen de que el usuario espere minutos sin cortar.
export interface AniListImportSummary {
  title: string;
  imageUrl: string;
  episodes: number | null;
  score: number | null;
  year: number | null;
  genres: string[];
  studios: string[];
  duration: string | null;
}

interface AniListBatchMedia {
  idMal: number | null;
  title: { romaji: string | null; english: string | null };
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  startDate: { year: number | null } | null;
  genres: string[] | null;
  studios: { nodes: { name: string }[] } | null;
  coverImage: { large: string | null; extraLarge: string | null } | null;
}

interface AniListBatchResponse {
  data: {
    Page: { media: AniListBatchMedia[] };
  };
}

const BATCH_SUMMARY_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        idMal
        title { romaji english }
        episodes
        duration
        averageScore
        seasonYear
        startDate { year }
        genres
        studios(isMain: true) { nodes { name } }
        coverImage { large extraLarge }
      }
    }
  }
`;

/** Hasta 50 ids de MAL por consulta — el mismo tope que usa `Page` en el resto de la app. */
export const getAnimeSummariesByMalIds = async (
  malIds: number[],
): Promise<Map<number, AniListImportSummary>> => {
  const result = new Map<number, AniListImportSummary>();
  if (malIds.length === 0) return result;

  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: BATCH_SUMMARY_QUERY, variables: { ids: malIds } }),
  });
  if (!response.ok) throw new Error('Error fetching from AniList');

  const json = (await response.json()) as AniListBatchResponse;
  (json.data?.Page?.media ?? []).forEach(m => {
    if (!m.idMal) return;
    result.set(m.idMal, {
      title: m.title.english || m.title.romaji || '',
      imageUrl: m.coverImage?.extraLarge || m.coverImage?.large || '',
      episodes: m.episodes,
      score: m.averageScore ? m.averageScore / 10 : null,
      year: m.seasonYear ?? m.startDate?.year ?? null,
      genres: m.genres ?? [],
      studios: (m.studios?.nodes || []).map(s => s.name),
      duration: m.duration ? `${m.duration} min per ep` : null,
    });
  });

  return result;
};
