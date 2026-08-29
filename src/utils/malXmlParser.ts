export async function readMalListFile(file: File): Promise<string> {
  const isGzip = file.name.toLowerCase().endsWith('.gz');
  if (!isGzip) return file.text();

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Tu navegador no puede descomprimir archivos .gz. Descomprimilo manualmente y subí el .xml.');
  }

  try {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch {
    throw new Error('No se pudo descomprimir el archivo .gz. Asegurate de que sea el archivo exportado desde MyAnimeList.');
  }
}

export interface MalAnimeEntry {
  malId: number;
  title: string;
  totalEpisodes: number;
  watchedEpisodes: number;
  userScore: number;
  malStatus: string;
  status: 'Completado' | 'Mirando' | 'Pendiente';
}

// Kiroku solo tiene tres estados, y MyAnimeList tiene cinco. "Dropped" y
// "On-Hold" no tienen equivalente, así que caen en "Pendiente" — que no es lo
// mismo que el usuario tenía. Se sigue importando (perder la entrada sería
// peor), pero `reclassifiedMalStatuses` deja contarlo para avisarlo antes de
// importar en vez de cambiarle la lista por atrás.
const RECLASSIFIED_MAL_STATUSES = new Set(['Dropped', 'On-Hold', 'On Hold']);

function mapMalStatus(s: string): MalAnimeEntry['status'] {
  if (s === 'Completed') return 'Completado';
  if (s === 'Watching') return 'Mirando';
  return 'Pendiente';
}

/** Entradas cuyo estado original de MAL no existe en Kiroku, por estado. */
export function getReclassifiedCounts(entries: MalAnimeEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (RECLASSIFIED_MAL_STATUSES.has(e.malStatus)) {
      counts[e.malStatus] = (counts[e.malStatus] || 0) + 1;
    }
  }
  return counts;
}

export function parseMalXml(xmlString: string): MalAnimeEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('El archivo XML no es válido.');
  }

  const animeNodes = doc.querySelectorAll('anime');
  if (animeNodes.length === 0) {
    throw new Error('No se encontraron animes en el archivo. Asegurate de exportar tu lista desde MyAnimeList.');
  }

  const entries: MalAnimeEntry[] = [];

  animeNodes.forEach(node => {
    const get = (tag: string) => node.querySelector(tag)?.textContent?.trim() ?? '';
    const malId = parseInt(get('series_animedb_id'), 10);
    if (!malId || isNaN(malId)) return;

    const malStatus = get('my_status');
    entries.push({
      malId,
      title: get('series_title'),
      totalEpisodes: parseInt(get('series_episodes'), 10) || 0,
      watchedEpisodes: parseInt(get('my_watched_episodes'), 10) || 0,
      userScore: parseInt(get('my_score'), 10) || 0,
      malStatus,
      status: mapMalStatus(malStatus),
    });
  });

  return entries;
}

export function getMalStatusCounts(entries: MalAnimeEntry[]) {
  return entries.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
