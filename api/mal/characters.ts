import { proxyJson, type MalReq, type MalRes } from '../_lib/mal.js';

// GET /api/mal/characters?anime_id=<malId>   → lista de personajes del anime
// GET /api/mal/characters?id=<characterId>   → detalle de un personaje
//
// Única fuente de la sección de personajes (ver src/services/malApi.ts).
// Antes el primario era Jikan, pero sus endpoints de personaje respondían
// 504 de forma sostenida ("Jikan failed to connect to MyAnimeList") incluso
// con la lista de la API oficial respondiendo normal, así que la sección
// pasó a depender solo de MAL.
//
// Ambos endpoints existen en la API v2 oficial aunque no figuran en su
// referencia pública — verificados contra la API en vivo con el Client ID
// del proyecto. Al no estar documentados pueden cambiar sin aviso, así que
// el cliente trata cualquier fallo como "sin datos" en vez de romper.

const LIST_FIELDS = 'first_name,last_name,main_picture,num_favorites';
const DETAIL_FIELDS = 'first_name,last_name,alternative_name,main_picture,biography,num_favorites,pictures';

export default async function handler(req: MalReq, res: MalRes) {
  const url = new URL(req.url || '', 'http://internal');
  const animeId = url.searchParams.get('anime_id');
  const characterId = url.searchParams.get('id');

  // Una semana en el CDN: el reparto de un anime es de las cosas más
  // estables que hay, y el cliente ya no guarda estas listas en localStorage
  // (pesan demasiado — ver getAnimeCharactersMal en src/services/malApi.ts),
  // así que este caché es lo único que separa cada recarga de página de una
  // petición nueva a MAL. `stale-while-revalidate` deja que la primera
  // visita después del vencimiento igual se sirva al instante.
  const CACHE = 'public, s-maxage=604800, stale-while-revalidate=86400';

  if (animeId && /^\d+$/.test(animeId)) {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
    await proxyJson(res, `/anime/${animeId}/characters?limit=${limit}&fields=${LIST_FIELDS}`, CACHE);
    return;
  }

  if (characterId && /^\d+$/.test(characterId)) {
    await proxyJson(res, `/characters/${characterId}?fields=${DETAIL_FIELDS}`, CACHE);
    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Falta anime_id o id válido' }));
}
