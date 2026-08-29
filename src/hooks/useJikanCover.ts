import { useEffect, useState } from 'react';
import { getMediaImage } from '../services/jikanApi';
import { getHighResImageUrl } from '../utils/animeUtils';

// MAL/Jikan cover art usually has the title logo baked into the key visual;
// AniList's covers are typically clean crops without it. We prefer Jikan's
// image for that reason, but never block rendering on it — the caller's
// `fallbackUrl` (AniList, or whatever was already available) shows immediately
// and this silently upgrades the src if/when Jikan's request succeeds.
/**
 * @param enabled Poner en false mientras la tarjeta no esté a la vista.
 *   Cada llamada es una petición a Jikan y todas comparten una única cola
 *   serializada de ~380 ms: una búsqueda de 40 resultados encolaba unos 15
 *   segundos de peticiones solo para mejorar portadas, compitiendo con las
 *   que sí importan. Gatearlo por visibilidad deja ese costo en las pocas
 *   tarjetas que la persona realmente mira.
 */
export function useJikanCover(malId: number, fallbackUrl: string, enabled = true): string {
  const [state, setState] = useState({ malId, url: fallbackUrl });

  // Reset synchronously during render when the card switches anime, instead
  // of via a setState-in-effect (avoids an extra cascading render).
  if (state.malId !== malId) {
    setState({ malId, url: fallbackUrl });
  }

  useEffect(() => {
    if (!malId || !enabled) return;
    let cancelled = false;

    getMediaImage('anime', malId)
      .then(res => {
        if (cancelled) return;
        const jikanUrl = getHighResImageUrl(
          res.data?.images?.jpg?.large_image_url || res.data?.images?.jpg?.image_url,
        );
        if (jikanUrl) setState(s => (s.malId === malId ? { malId, url: jikanUrl } : s));
      })
      .catch(() => { /* keep fallbackUrl */ });

    return () => { cancelled = true; };
  }, [malId, enabled]);

  return state.url;
}
