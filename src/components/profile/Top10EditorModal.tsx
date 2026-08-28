import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { X, Search, Check, ArrowUp, ArrowDown, Trash2, Loader2, Trophy } from 'lucide-react';
import type { SavedAnime, Top10Entry } from '../../types/profile';

interface Top10EditorModalProps {
  animes: SavedAnime[];
  initialEntries: Top10Entry[];
  onClose: () => void;
  onSave: (entries: Top10Entry[]) => Promise<boolean>;
}

const MAX_SLOTS = 10;

export const Top10EditorModal = ({ animes, initialEntries, onClose, onSave }: Top10EditorModalProps) => {
  const [selected, setSelected] = useState<Top10Entry[]>(() =>
    [...initialEntries]
      .sort((a, b) => a.rank - b.rank)
      .map(({ rank, anime_id, title, image_url }) => ({ rank, anime_id, title, image_url }))
  );
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Solo "Completado" — un favorito en Mirando/Pendiente igual queda afuera,
  // porque todavía no hay una opinión formada sobre el anime.
  const pool = useMemo(() => animes.filter(a => a.status === 'Completado'), [animes]);

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(a => a.title.toLowerCase().includes(q));
  }, [pool, query]);

  const selectedIds = new Set(selected.map(e => e.anime_id));

  const addAnime = (anime: SavedAnime) => {
    if (selectedIds.has(anime.anime_id) || selected.length >= MAX_SLOTS) return;
    setSelected(prev => [
      ...prev,
      { rank: prev.length + 1, anime_id: anime.anime_id, title: anime.title, image_url: anime.image_url },
    ]);
  };

  const removeAt = (index: number) => {
    setSelected(prev => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, rank: i + 1 })));
  };

  const move = (index: number, dir: -1 | 1) => {
    setSelected(prev => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((e, i) => ({ ...e, rank: i + 1 }));
    });
  };

  const handleSave = async () => {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    const ok = await onSave(selected);
    setSaving(false);
    if (ok) {
      toast.success('¡Tu Top 10 fue guardado!');
      onClose();
    } else {
      toast.error('No se pudo guardar tu Top 10. Intentá de nuevo.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !saving && onClose()} />

      <div className="relative z-10 w-full max-w-4xl max-h-[88vh] bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#FF3B3B]/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center shrink-0">
              <Trophy size={16} className="text-[#FF3B3B]" />
            </div>
            <div>
              <h2 className="font-black text-white text-lg leading-tight">Armá tu Top 10</h2>
              <p className="text-xs text-zinc-600 font-bold mt-0.5">Solo animes completados · {selected.length}/{MAX_SLOTS}</p>
            </div>
          </div>
          {!saving && (
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 shrink-0">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* Pool de animes completados */}
          <div className="flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-[#FF3B3B]/10">
            <div className="p-4 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar en tus completados..."
                  className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-[260px]">
              {pool.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
                  <p className="text-zinc-500 text-sm font-bold">Aún no tenés animes completados.</p>
                  <p className="text-zinc-700 text-xs max-w-[220px]">Marcá animes como "Completado" en tu lista para poder agregarlos a tu Top 10.</p>
                </div>
              ) : filteredPool.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-10">Sin resultados para "{query}"</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {filteredPool.map(anime => {
                    const isSelected = selectedIds.has(anime.anime_id);
                    const disabled = !isSelected && selected.length >= MAX_SLOTS;
                    return (
                      <button
                        key={anime.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => !isSelected && addAnime(anime)}
                        className={`group relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected ? 'border-[#FF3B3B] opacity-40 cursor-default'
                          : disabled ? 'border-transparent opacity-30 cursor-not-allowed'
                          : 'border-transparent hover:border-[#FF3B3B]/60 cursor-pointer'
                        }`}
                      >
                        <img src={anime.image_url} alt={anime.title} loading="lazy" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <span className="absolute bottom-1 left-1 right-1 text-[10px] font-bold text-white line-clamp-2 leading-tight">
                          {anime.title}
                        </span>
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <div className="w-7 h-7 rounded-full bg-[#FF3B3B] flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Ranking seleccionado */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2 shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Tu ranking</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-[260px]">
              {selected.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center py-10">
                  <p className="text-zinc-700 text-xs max-w-[200px]">Tocá un anime de la izquierda para agregarlo a tu Top 10.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selected.map((entry, i) => (
                    <div key={entry.anime_id} className="flex items-center gap-3 bg-[#0D0F15] border border-[#FF3B3B]/[0.08] rounded-xl p-2 pr-3">
                      <span className="w-6 shrink-0 text-center font-black text-[#FF3B3B] text-sm tabular-nums">{i + 1}</span>
                      <img src={entry.image_url} alt={entry.title} className="w-10 h-14 object-cover rounded-md shrink-0" />
                      <span className="flex-1 min-w-0 text-xs font-bold text-white line-clamp-2 leading-tight">{entry.title}</span>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-zinc-600 hover:text-white disabled:opacity-20 transition-colors">
                          <ArrowUp size={13} />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="p-1 text-zinc-600 hover:text-white disabled:opacity-20 transition-colors">
                          <ArrowDown size={13} />
                        </button>
                      </div>
                      <button type="button" onClick={() => removeAt(i)} className="p-1.5 text-zinc-600 hover:text-[#FF3B3B] transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-[#FF3B3B]/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 bg-[#0D0F15] border border-[#FF3B3B]/15 text-zinc-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.length === 0 || saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar Top 10
          </button>
        </div>
      </div>
    </div>
  );
};
