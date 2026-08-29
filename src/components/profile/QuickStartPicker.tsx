import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { searchAniList } from '../../services/aniListApi';
import { supabase } from '../../lib/supabase';
import type { Anime } from '../../types/anime';

interface QuickStartPickerProps {
  userId: string;
  onSaved: () => void | Promise<void>;
}

const SUGGESTED = 24;
const TARGET = 5;

/**
 * Primer paso real del onboarding.
 *
 * Antes, después de registrarse, el perfil quedaba en cero: sin estadísticas,
 * sin logros, sin Top 10 y sin gráficos — justo lo que hace atractiva la app
 * estaba todo vacío, y llenarlo requería buscar y guardar de a un anime por
 * vez. Marcar cinco que ya viste alcanza para que todo eso aparezca de una.
 *
 * Se guardan como "Completado" con el progreso al total: es lo que significa
 * "ya lo vi", y es lo que alimenta horas vistas, géneros y estudios.
 */
export const QuickStartPicker = ({ userId, onSaved }: QuickStartPickerProps) => {
  const [options, setOptions] = useState<Anime[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    searchAniList({ page: 1, perPage: SUGGESTED, sort: ['POPULARITY_DESC'] })
      .then(res => { if (!cancelled) setOptions(res.data); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: number) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (picked.size === 0 || !options) return;
    setSaving(true);

    const rows = options
      .filter(a => picked.has(a.mal_id))
      .map(a => ({
        user_id: userId,
        anime_id: a.mal_id,
        title: a.title,
        image_url: a.images.jpg.large_image_url || a.images.jpg.image_url || '',
        status: 'Completado',
        episodes_total: a.episodes,
        score: a.score ?? null,
        is_favorite: false,
        year: a.aired?.from ? new Date(a.aired.from).getFullYear() : null,
        genres: a.genres?.map(g => g.name) ?? [],
        studios: [],
        duration: null,
        progress: a.episodes ?? 0,
      }));

    const { error } = await supabase
      .from('saved_animes')
      .upsert(rows, { onConflict: 'user_id,anime_id', ignoreDuplicates: true });

    if (error) {
      toast.error('No se pudieron guardar. Probá de nuevo.');
      setSaving(false);
      return;
    }

    toast.success(`¡Listo! ${rows.length} anime${rows.length !== 1 ? 's' : ''} en tu perfil.`);
    await onSaved();
    setSaving(false);
  };

  if (options !== null && options.length === 0) return null;

  return (
    <div className="bg-[#11131A] border border-[#FF3B3B]/25 rounded-2xl p-6 md:p-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/40 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#FF3B3B] mb-2">
            <Sparkles size={12} /> Empezá en 10 segundos
          </p>
          <h3 className="text-white font-black text-xl md:text-2xl mb-2 tracking-tight">
            Marcá {TARGET} animes que ya viste
          </h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-lg">
            Con eso solo, tu perfil arranca con estadísticas, géneros favoritos y logros.
            Después podés ajustar todo desde tu lista.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={picked.size === 0 || saving}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#FF3B3B] hover:bg-[#FF5555] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {picked.size === 0
            ? 'Elegí al menos uno'
            : `Guardar ${picked.size}`}
        </button>
      </div>

      {options === null ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[#FF3B3B]" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {options.map(a => {
            const isPicked = picked.has(a.mal_id);
            return (
              <button
                key={a.mal_id}
                onClick={() => toggle(a.mal_id)}
                aria-pressed={isPicked}
                title={a.title}
                className={`group relative aspect-[3/4] rounded-lg overflow-hidden border transition-all ${
                  isPicked
                    ? 'border-[#FF3B3B] ring-2 ring-[#FF3B3B]/40'
                    : 'border-[#FF3B3B]/10 hover:border-[#FF3B3B]/40'
                }`}
              >
                <img
                  src={a.images.jpg.large_image_url || a.images.jpg.image_url}
                  alt={a.title}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-all ${
                    isPicked ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'
                  }`}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0D0F15] to-transparent px-1.5 pt-4 pb-1.5">
                  <span className="block text-[9px] font-bold text-zinc-300 leading-tight line-clamp-2">
                    {a.title}
                  </span>
                </div>
                {isPicked && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF3B3B] flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
