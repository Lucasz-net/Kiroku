import { useEffect, useState } from 'react';
import { getMediaImage } from '../services/jikanApi';
import { getHighResImageUrl } from '../utils/animeUtils';

// MAL/Jikan cover art usually has the title logo baked into the key visual;
// AniList's covers are typically clean crops without it. We prefer Jikan's
// image for that reason, but never block rendering on it — the caller's
// `fallbackUrl` (AniList, or whatever was already available) shows immediately
// and this silently upgrades the src if/when Jikan's request succeeds.
export function useJikanCover(malId: number, fallbackUrl: string): string {
  const [state, setState] = useState({ malId, url: fallbackUrl });

  // Reset synchronously during render when the card switches anime, instead
  // of via a setState-in-effect (avoids an extra cascading render).
  if (state.malId !== malId) {
    setState({ malId, url: fallbackUrl });
  }

  useEffect(() => {
    if (!malId) return;
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
  }, [malId]);

  return state.url;
}
