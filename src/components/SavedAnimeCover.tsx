import { useEffect, useState } from 'react';
import { getMediaImage } from '../services/jikanApi';
import { getHighResImageUrl } from '../utils/animeUtils';
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
 * La importación ahora inserta las filas directo desde el XML, sin llamar a
 * ninguna API — por eso la lista aparece completa en segundos en vez de en
 * minutos. El precio es que esas filas nacen sin `image_url`, así que la
 * portada se resuelve acá: solo para las tarjetas que llegan a verse, por la
 * cola compartida de Jikan, y se guarda en la fila para no volver a pedirla
 * nunca más.
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

    getMediaImage('anime', animeId)
      .then(res => {
        if (cancelled) return;
        const resolved = getHighResImageUrl(
          res.data?.images?.jpg?.large_image_url || res.data?.images?.jpg?.image_url,
        );
        if (!resolved) return;
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
    <div ref={ref} className={`relative bg-[#0D0F15] ${className}`}>
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
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1A1C24] to-[#0D0F15] text-zinc-700 font-black select-none"
        >
          {title.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};
