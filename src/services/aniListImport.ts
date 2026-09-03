import { ANILIST_URL } from './aniListApi';

/**
 * Importar la lista de anime de una cuenta de AniList.
 *
 * **Por qué se pide el nombre de usuario y no un archivo.** AniList no ofrece
 * una exportación propia cómoda: la comunidad resuelve el traspaso con
 * conversores de terceros que arman un XML con formato de MyAnimeList. Pedir
 * un archivo sería mandar a la persona a buscar una herramienta ajena antes
 * de poder usar la nuestra. En cambio `MediaListCollection` devuelve la lista
 * completa de cualquier perfil público **sin autenticación** — verificado
 * contra la API en vivo (2026-09-03) con una cuenta real: 3 listas, 32
 * entradas, HTTP 200 sin ningún token.
 *
 * Eso además lo vuelve la opción más segura posible: no se pide contraseña,
 * no hay OAuth, no se guarda ningún token y no se puede escribir nada en la
 * cuenta ajena. Solo se lee lo que esa persona ya publicó — sus entradas
 * privadas ni siquiera vienen en la respuesta, que es lo que corresponde.
 *
 * Y trae de regalo algo que el XML de MyAnimeList no tiene: portada, géneros,
 * estudios, duración y año llegan en la misma respuesta. Una importación
 * desde AniList queda completa de entrada, sin necesitar el pase de
 * completado en segundo plano que sí requiere la de MAL (ver
 * `startImportEnrichment` en UserDataContext).
 *
 * El equivalente para MyAnimeList es `src/utils/malXmlParser.ts`.
 */

/** Tope documentado de `perChunk`. La mayoría de las listas entra en una sola. */
const CHUNK_SIZE = 500;

/**
 * Pausa entre tandas. AniList limita a 30 peticiones por minuto (cabecera
 * `X-RateLimit-Limit`, confirmada en vivo), o sea 2 s por consulta.
 */
const CHUNK_DELAY_MS = 2100;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface AniListImportEntry {
  malId: number;
  title: string;
  imageUrl: string;
  totalEpisodes: number;
  watchedEpisodes: number;
  userScore: number;
  /** Estado tal cual lo tiene en AniList, para poder avisar qué se reubicó. */
  aniListStatus: string;
  status: 'Completado' | 'Mirando' | 'Pendiente';
  score: number | null;
  year: number | null;
  genres: string[];
  studios: string[];
  duration: string | null;
}

export interface AniListImportResult {
  entries: AniListImportEntry[];
  /**
   * Entradas descartadas por no tener id de MyAnimeList. Kiroku indexa todo
   * por ese id (las rutas `/anime/:id`, `saved_animes.anime_id`), así que un
   * título que solo existe en AniList no se puede guardar. Se cuentan para
   * poder decirlo en pantalla en vez de que la suma no cierre en silencio.
   */
  withoutMalId: number;
}

export class AniListUserNotFoundError extends Error {
  constructor(userName: string) {
    super(`No existe el usuario ${userName} en AniList`);
    this.name = 'AniListUserNotFoundError';
  }
}

/**
 * Kiroku tiene tres estados y AniList seis. Se reproduce el mismo criterio de
 * la importación de MyAnimeList (ver malXmlParser.ts): lo que no tiene
 * equivalente cae en "Pendiente" y se avisa antes de importar, porque perder
 * la entrada sería peor que reubicarla.
 */
const STATUS_MAP: Record<string, AniListImportEntry['status']> = {
  COMPLETED: 'Completado',
  CURRENT: 'Mirando',
  // Reverla es estar mirándola.
  REPEATING: 'Mirando',
  PLANNING: 'Pendiente',
  PAUSED: 'Pendiente',
  DROPPED: 'Pendiente',
};

/** Estados de AniList que no existen en Kiroku, con su nombre en español. */
export const RECLASSIFIED_STATUSES: Record<string, string> = {
  PAUSED: 'En pausa',
  DROPPED: 'Abandonado',
};

interface MediaListEntry {
  status: string | null;
  progress: number | null;
  score: number | null;
  media: {
    idMal: number | null;
    title: { romaji: string | null; english: string | null };
    episodes: number | null;
    duration: number | null;
    seasonYear: number | null;
    startDate: { year: number | null } | null;
    averageScore: number | null;
    genres: string[] | null;
    studios: { edges: { isMain: boolean; node: { name: string } }[] } | null;
    coverImage: { large: string | null; extraLarge: string | null } | null;
  } | null;
}

interface CollectionResponse {
  data?: {
    MediaListCollection: {
      hasNextChunk: boolean;
      lists: { entries: MediaListEntry[] }[];
    } | null;
  } | null;
  errors?: { message: string; status?: number }[];
}

// `score(format: POINT_10_DECIMAL)` normaliza la escala. Cada usuario de
// AniList elige la suya (100 puntos, 10, 10 con decimales, 5 estrellas, 3
// caritas) y sin ese argumento llegaría el número crudo. Kiroku guarda 0-10
// con una restricción en la base, así que un 85 sin convertir haría fallar el
// insert entero.
const USER_LIST_QUERY = `
  query ($userName: String, $chunk: Int, $perChunk: Int) {
    MediaListCollection(userName: $userName, type: ANIME, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          status
          progress
          score(format: POINT_10_DECIMAL)
          media {
            idMal
            title { romaji english }
            episodes
            duration
            seasonYear
            startDate { year }
            averageScore
            genres
            # Ojo: acá NO sirve \`studios(isMain: true) { nodes }\`, que es lo
            # que usa el resto de la app. Dentro de MediaListCollection ese
            # argumento se ignora y devuelve también productoras y canales de
            # TV — para "Make Heroine ga Oosugiru!" son 8 nombres (Aniplex,
            # BS11, TOKYO MX, Good Smile Company...) en vez de A-1 Pictures
            # sola. Comprobado contra la API en vivo (2026-09-03): el mismo
            # filtro sí funciona en Media y en Page.media, así que es una
            # rareza de esta consulta y no un error nuestro. Con \`edges\` y
            # filtrando acá abajo el resultado es el correcto.
            studios { edges { isMain node { name } } }
            coverImage { large extraLarge }
          }
        }
      }
    }
  }
`;

/** Recorta a lo que aceptan las restricciones CHECK de `saved_animes`. */
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Lee la lista de anime pública de una cuenta de AniList.
 *
 * @param onProgress Se llama con el acumulado al terminar cada tanda, para
 *   poder mostrar avance en listas grandes.
 */
export const fetchAniListUserList = async (
  userName: string,
  onProgress?: (loaded: number) => void,
): Promise<AniListImportResult> => {
  const entries: AniListImportEntry[] = [];
  // Un mismo anime viene repetido si la persona lo tiene también en una lista
  // personalizada: `MediaListCollection` devuelve una entrada por lista.
  const seen = new Set<number>();
  let withoutMalId = 0;
  let chunk = 1;

  for (;;) {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      // El nombre viaja como variable de GraphQL, nunca interpolado dentro de
      // la consulta: es texto que escribe el usuario.
      body: JSON.stringify({
        query: USER_LIST_QUERY,
        variables: { userName, chunk, perChunk: CHUNK_SIZE },
      }),
    });

    const json = (await response.json().catch(() => ({}))) as CollectionResponse;

    // AniList contesta 404 con `errors[0].status = 404` cuando el usuario no
    // existe. Verificado en vivo.
    if (response.status === 404 || json.errors?.some(e => e.status === 404)) {
      throw new AniListUserNotFoundError(userName);
    }
    if (!response.ok) throw new Error('AniList no respondió. Probá de nuevo en un momento.');

    const collection = json.data?.MediaListCollection;
    // Una cuenta sin lista pública devuelve la colección vacía, no un error.
    if (!collection) return { entries, withoutMalId };

    for (const list of collection.lists ?? []) {
      for (const entry of list.entries ?? []) {
        const media = entry.media;
        if (!media) continue;
        if (!media.idMal) { withoutMalId++; continue; }
        if (seen.has(media.idMal)) continue;
        seen.add(media.idMal);

        const rawScore = entry.score ?? 0;
        entries.push({
          malId: media.idMal,
          title: media.title.romaji || media.title.english || `Anime ${media.idMal}`,
          imageUrl: media.coverImage?.extraLarge || media.coverImage?.large || '',
          totalEpisodes: media.episodes ?? 0,
          watchedEpisodes: clamp(entry.progress ?? 0, 0, 10000),
          // 0 en AniList significa "sin puntuar", no "un cero".
          userScore: rawScore > 0 ? clamp(rawScore, 0, 10) : 0,
          aniListStatus: entry.status ?? 'PLANNING',
          status: STATUS_MAP[entry.status ?? ''] ?? 'Pendiente',
          score: media.averageScore ? media.averageScore / 10 : null,
          year: media.seasonYear ?? media.startDate?.year ?? null,
          genres: media.genres ?? [],
          // Solo el estudio de animación: ver el comentario en la consulta.
          studios: (media.studios?.edges ?? []).filter(e => e.isMain).map(e => e.node.name),
          duration: media.duration ? `${media.duration} min per ep` : null,
        });
      }
    }

    onProgress?.(entries.length);
    if (!collection.hasNextChunk) break;
    chunk++;
    await sleep(CHUNK_DELAY_MS);
  }

  return { entries, withoutMalId };
};

/** Cuántas entradas quedaron en un estado distinto al que tenían, por estado. */
export function getReclassifiedCounts(entries: AniListImportEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.aniListStatus in RECLASSIFIED_STATUSES) {
      counts[e.aniListStatus] = (counts[e.aniListStatus] || 0) + 1;
    }
  }
  return counts;
}

export function getStatusCounts(entries: AniListImportEntry[]): Record<string, number> {
  return entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Normaliza lo que la persona escribe en el campo. Se acepta pegar el enlace
 * del perfil (`anilist.co/user/Nombre/animelist`) porque es lo que uno tiene
 * a mano cuando está mirando su propia lista.
 */
export function normalizeAniListUsername(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/anilist\.co\/user\/([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, '').trim();
}
