import { useEffect, useState } from 'react';
import { getCoverUrl } from '../services/jikanApi';

// MAL/Jikan cover art usually has the title logo baked into the key visual;
// AniList's covers are typically clean crops without it. We prefer MAL's
// image for that reason, but never block rendering on it — the caller's
// `fallbackUrl` (AniList, or whatever was already available) shows immediately
// and this silently upgrades the src if/when the request succeeds.
/**
 * @param enabled Poner en false mientras la tarjeta no esté a la vista.
 *   Sigue valiendo la pena aunque las portadas ahora salgan del proxy propio
 *   con caché de CDN (ver getCoverUrl): una petición que no se hace es más
 *   barata que una que acierta en caché, y no tiene sentido resolver la
 *   portada de una tarjeta que la persona nunca va a ver.
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

    getCoverUrl('anime', malId)
      .then(coverUrl => {
        if (cancelled || !coverUrl) return;
        setState(s => (s.malId === malId ? { malId, url: coverUrl } : s));
      })
      .catch(() => { /* keep fallbackUrl */ });

    return () => { cancelled = true; };
  }, [malId, enabled]);

  return state.url;
}
