import { useEffect, useState } from 'react';
import { getCoverUrl } from '../services/jikanApi';
import { useInView } from '../hooks/useInView';
import { supabase } from '../lib/supabase';

interface SavedAnimeCoverProps {
  animeId: number;
  title: string;
  /** Puede venir vacío: la importación guarda las filas sin portada. */
  imageUrl: string;
  /** Id de la fila en saved_animes, para persistir la portada al resolverla. */
  rowId?: string;
  className?: string;
}

/**
 * Portada de un anime guardado, tolerante a que todavía no tenga ninguna.
 *
 * La importación inserta las filas directo desde el XML, sin llamar a ninguna
 * API — por eso la lista aparece completa en segundos en vez de en minutos.
 * El precio es que esas filas nacen sin `image_url`.
 *
 * El grueso de esas portadas lo completa `backfillSavedMetadata`
 * (UserDataContext) en lotes contra AniList, en segundo plano. Esto de acá es
 * la red de contención para lo que ese pase todavía no cubrió: resuelve la
 * portada de las tarjetas que llegan a verse y la guarda en la fila, así que
 * cada anime se pide una sola vez en la vida de la cuenta.
 *
 * El guardado es best-effort: si quien mira no es el dueño, la RLS no deja
 * escribir y la actualización simplemente no afecta ninguna fila.
 */
export const SavedAnimeCover = ({
  animeId, title, imageUrl, rowId, className = '',
}: SavedAnimeCoverProps) => {
  const [url, setUrl] = useState(imageUrl);
  const { ref, inView } = useInView<HTMLDivElement>();

  useEffect(() => { setUrl(imageUrl); }, [imageUrl]);

  useEffect(() => {
    if (url || !inView || !animeId) return;
    let cancelled = false;

    getCoverUrl('anime', animeId)
      .then(resolved => {
        if (cancelled || !resolved) return;
        setUrl(resolved);
        if (rowId) {
          supabase.from('saved_animes').update({ image_url: resolved }).eq('id', rowId)
            .then(() => { /* best-effort */ });
        }
      })
      .catch(() => { /* se queda el marcador */ });

    return () => { cancelled = true; };
  }, [url, inView, animeId, rowId]);

  return (
    <div ref={ref} className={`relative bg-[var(--kr-surface-sunken)] ${className}`}>
      {url ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--kr-surface-2)] to-[var(--kr-surface-sunken)] text-zinc-700 font-black select-none"
        >
          {title.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};
