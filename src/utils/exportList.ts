import type { SavedAnime } from '../types/profile';

/**
 * Exportación de la lista. Existe por una razón concreta: la política de
 * privacidad ofrece exportar tus datos, y hasta ahora eso significaba
 * pedírselo a Lucas por email. Además es lo que hace razonable confiarle
 * años de historial a una app nueva: se puede sacar cuando quieras.
 *
 * Dos formatos:
 *   · XML compatible con MyAnimeList, que es el que aceptan MAL, AniList y
 *     los importadores de terceros — sirve para irse a otro lado.
 *   · JSON con la fila completa, para respaldo propio (guarda cosas que el
 *     XML de MAL no contempla, como favoritos o la portada).
 */

const MAL_STATUS: Record<string, string> = {
  'Completado': 'Completed',
  'Mirando': 'Watching',
  'Pendiente': 'Plan to Watch',
};

// Los caracteres de control son ilegales en XML 1.0 y hacen fallar al parser
// entero, así que se sacan antes de escapar. Se hace por código de carácter y
// no con una expresión regular para no tener que meter literales de control
// en el fuente.
const stripControlChars = (value: string): string =>
  [...value].filter(ch => {
    const code = ch.charCodeAt(0);
    return code > 31 || code === 9 || code === 10 || code === 13;
  }).join('');

/** Escapa lo mínimo para que el XML sea válido con cualquier título. */
const xmlEscape = (value: string): string =>
  stripControlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildMalXml(animes: SavedAnime[], username: string): string {
  const entries = animes.map(a => `  <anime>
    <series_animedb_id>${a.anime_id}</series_animedb_id>
    <series_title>${xmlEscape(a.title)}</series_title>
    <series_episodes>${a.episodes_total ?? 0}</series_episodes>
    <my_watched_episodes>${a.progress ?? 0}</my_watched_episodes>
    <my_score>${a.user_score ?? 0}</my_score>
    <my_status>${MAL_STATUS[a.status] ?? 'Plan to Watch'}</my_status>
    <update_on_import>1</update_on_import>
  </anime>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_name>${xmlEscape(username)}</user_name>
    <user_export_type>1</user_export_type>
    <user_total_anime>${animes.length}</user_total_anime>
  </myinfo>
${entries}
</myanimelist>
`;
}

export function buildKirokuJson(animes: SavedAnime[], username: string): string {
  return JSON.stringify({
    source: 'kiroku',
    version: 1,
    exported_at: new Date().toISOString(),
    username,
    count: animes.length,
    anime: animes.map(a => ({
      anime_id: a.anime_id,
      title: a.title,
      status: a.status,
      episodes_total: a.episodes_total,
      progress: a.progress ?? 0,
      user_score: a.user_score ?? null,
      is_favorite: a.is_favorite,
      year: a.year,
      genres: a.genres ?? [],
      studios: a.studios ?? [],
      image_url: a.image_url,
      created_at: a.created_at,
    })),
  }, null, 2);
}

/** Dispara la descarga en el navegador. */
export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revocar en el próximo tick: hacerlo de inmediato cancela la descarga en
  // algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const exportFilename = (username: string, ext: string) =>
  `kiroku-${username || 'lista'}-${new Date().toISOString().slice(0, 10)}.${ext}`;
