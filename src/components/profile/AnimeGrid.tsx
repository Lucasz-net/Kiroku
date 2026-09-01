import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SavedAnimeCover } from '../SavedAnimeCover';
import { Link } from 'react-router-dom';
import { Heart, Trash2, ChevronLeft, ChevronRight, Search, Star, BookmarkCheck, Eye, Clock, ArrowUpDown } from 'lucide-react';
import type { SavedAnime } from '../../types/profile';
import { PROFILE_TABS } from '../../constants/profile';

const ITEMS_PER_PAGE = 28;

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'rating_desc' | 'rating_asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc',   label: 'Agregados recientemente' },
  { value: 'date_asc',    label: 'Agregados hace más tiempo' },
  { value: 'name_asc',    label: 'Nombre (A-Z)' },
  { value: 'name_desc',   label: 'Nombre (Z-A)' },
  { value: 'rating_desc', label: 'Mi puntuación (mayor a menor)' },
  { value: 'rating_asc',  label: 'Mi puntuación (menor a mayor)' },
];

// Preferencia solo de UI — no hay columna de orden en la base de datos,
// así que se guarda en localStorage y persiste entre visitas al perfil.
const SORT_STORAGE_KEY = 'kiroku:profile-anime-sort';

const loadStoredSort = (): SortKey => {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (SORT_OPTIONS.some(o => o.value === stored)) return stored as SortKey;
  } catch { /* localStorage no disponible (modo privado, etc.) */ }
  return 'date_desc';
};

// Sin puntuación propia siempre queda al final, sin importar la dirección.
const compareRating = (a: SavedAnime, b: SavedAnime, dir: 1 | -1) => {
  if (a.user_score == null && b.user_score == null) return 0;
  if (a.user_score == null) return 1;
  if (b.user_score == null) return -1;
  return (a.user_score - b.user_score) * dir;
};

const sortAnimes = (list: SavedAnime[], key: SortKey): SavedAnime[] => {
  const copy = [...list];
  switch (key) {
    case 'name_asc':    return copy.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
    case 'name_desc':   return copy.sort((a, b) => b.title.localeCompare(a.title, 'es', { sensitivity: 'base' }));
    case 'date_asc':    return copy.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    case 'rating_desc': return copy.sort((a, b) => compareRating(a, b, -1));
    case 'rating_asc':  return copy.sort((a, b) => compareRating(a, b, 1));
    default:            return copy.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  }
};

interface AnimeGridProps {
  animes: SavedAnime[];
  onRemove?: (id: string) => void;
  isOwner?: boolean;
}

// Empty state ilustrado (#15)
const EmptyGridState = ({ tab }: { tab: string }) => (
  <div className="text-center py-24 flex flex-col items-center gap-4 my-auto">
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="opacity-25">
      <rect x="8" y="8" width="56" height="56" rx="8" stroke="#FF3B3B" strokeWidth="2.5" strokeDasharray="6 4" />
      <path d="M26 36h20M36 26v20" stroke="#FF3B3B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <p className="text-zinc-400 text-base font-black">
      {tab === 'Favoritos' ? 'Sin favoritos aún' :
       tab === 'Todos' ? 'Lista vacía' :
       tab === 'Completado' ? 'Sin animes completados' :
       tab === 'Mirando' ? 'No estás mirando nada' :
       'Sin pendientes'}
    </p>
    <p className="text-zinc-600 text-sm">
      {tab === 'Favoritos'
        ? 'Marca un anime con ♥ para agregarlo aquí.'
        : 'Agrega animes desde la página de detalles.'}
    </p>
    <Link
      to="/search"
      className="mt-2 text-[#FF3B3B] font-bold hover:bg-[#FF3B3B]/10 bg-[var(--kr-surface)] border border-[#FF3B3B]/30 hover:border-[#FF3B3B]/60 px-8 py-3 uppercase tracking-widest transition-all rounded-lg text-xs flex items-center gap-2"
    >
      <Search size={13} /> Explorar Catálogo
    </Link>
  </div>
);

export const AnimeGrid = ({ animes, onRemove, isOwner = false }: AnimeGridProps) => {
  const [activeTab, setActiveTab] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(() => (isOwner ? loadStoredSort() : 'date_desc'));
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortListboxId = useId();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    setCurrentPage(1);
    setShowSortDropdown(false);
    sortTriggerRef.current?.focus();
    try { localStorage.setItem(SORT_STORAGE_KEY, key); } catch { /* localStorage no disponible */ }
  };

  const filteredAnimes = animes.filter(a => {
    if (activeTab === 'Favoritos') return a.is_favorite;
    if (activeTab === 'Todos') return true;
    return a.status === activeTab;
  });

  const sortedAnimes = useMemo(() => sortAnimes(filteredAnimes, sortKey), [filteredAnimes, sortKey]);
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? 'Ordenar';

  const totalPages = Math.ceil(sortedAnimes.length / ITEMS_PER_PAGE);
  const effectivePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const paginatedAnimes = sortedAnimes.slice((effectivePage - 1) * ITEMS_PER_PAGE, effectivePage * ITEMS_PER_PAGE);

  return (
    <div className="lg:col-span-8 xl:col-span-8">
      <div className="bg-[var(--kr-glass-1)] backdrop-blur-xl rounded-2xl border border-[#FF3B3B]/20 min-h-[800px] flex flex-col">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#FF3B3B]/15 bg-[var(--kr-glass-4)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 pt-4 px-4 rounded-t-2xl">
          {PROFILE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 min-w-[130px] py-4 px-4 text-[13px] font-bold uppercase tracking-widest transition-colors relative flex items-center justify-center gap-2 ${activeTab === tab.id ? 'text-[#FF3B3B] bg-[#FF3B3B]/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#FF3B3B]/5'}`}
            >
              <tab.icon size={14} className={activeTab === tab.id ? 'text-[#FF3B3B]' : 'text-zinc-600'} />
              {tab.id}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF3B3B]" />}
            </button>
          ))}
        </div>

        <div className="px-6 pt-3 pb-6 md:px-8 md:pt-4 md:pb-8 flex-1 flex flex-col">
          {isOwner && paginatedAnimes.length > 0 && (
            <div
              className="relative self-end mb-3"
              ref={sortRef}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setShowSortDropdown(false); sortTriggerRef.current?.focus(); } }}
            >
              <button
                ref={sortTriggerRef}
                onClick={() => setShowSortDropdown(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={showSortDropdown}
                aria-controls={sortListboxId}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[var(--kr-text)] transition-colors"
              >
                <ArrowUpDown size={12} className="text-[#FF3B3B]/40" />
                {currentSortLabel}
              </button>
              {showSortDropdown && (
                <div id={sortListboxId} role="listbox" className="absolute right-0 top-full mt-2 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-20 min-w-52 rounded-xl overflow-hidden">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      role="option"
                      aria-selected={sortKey === opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-[var(--kr-surface)] border-b border-[#FF3B3B]/[0.07] last:border-0 ${sortKey === opt.value ? 'text-[#FF3B3B] bg-[var(--kr-glass-2)]' : 'text-zinc-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {paginatedAnimes.length === 0 ? (
            <EmptyGridState tab={activeTab} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 mb-8">
                {paginatedAnimes.map(anime => {
                  const statusCfgs: Record<string, { icon: typeof Eye; color: string }> = {
                    Completado: { icon: BookmarkCheck, color: 'text-[#FF3B3B]' },
                    Mirando:    { icon: Eye,           color: 'text-[#FF7777]' },
                    Pendiente:  { icon: Clock,         color: 'text-[#FF9B9B]' },
                  };
                  const sCfg = statusCfgs[anime.status] ?? { icon: Clock, color: 'text-zinc-500' };
                  const StatusIcon = sCfg.icon;

                  return (
                    <div key={anime.id} className="group relative bg-[var(--kr-surface)] overflow-hidden rounded-lg border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 transition-all duration-300">
                      <Link to={`/anime/${anime.anime_id}`} className="block relative aspect-[3/4] overflow-hidden">
                        <SavedAnimeCover
                          animeId={anime.anime_id}
                          title={anime.title}
                          imageUrl={anime.image_url}
                          rowId={anime.id}
                          className="w-full h-full overflow-hidden transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kr-surface)] via-transparent to-transparent opacity-90" />
                        <div className="absolute bottom-0 left-0 w-full p-3">
                          <h4 className="text-[var(--kr-text)] text-xs md:text-sm font-bold line-clamp-2 leading-tight mb-2">{anime.title}</h4>
                          <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${sCfg.color}`}>
                            <StatusIcon size={11} />
                            {anime.status}
                          </span>
                        </div>
                      </Link>

                      {onRemove && (
                        <button
                          onClick={() => onRemove(anime.id)}
                          className="absolute top-2 right-2 w-8 h-8 bg-[var(--kr-glass-2)] backdrop-blur-md flex items-center justify-center text-zinc-500 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/10 border border-[#FF3B3B]/15 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {anime.is_favorite && (
                        <div className="absolute top-2 left-2 w-8 h-8 bg-[var(--kr-glass-2)] backdrop-blur-md flex items-center justify-center border border-[#FF3B3B]/15 rounded-lg">
                          <Heart size={14} className="fill-[#FF3B3B] text-[#FF7777]" />
                        </div>
                      )}

                      {/* Puntuación del usuario (#2) */}
                      {anime.user_score && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-[var(--kr-glass-1)] backdrop-blur-sm border border-[#FF3B3B]/20 px-1.5 py-1 rounded-md">
                          <Star size={11} className="fill-[#FF3B3B] text-[#FF3B3B]" />
                          <span className="text-[var(--kr-text)] text-xs font-black tabular-nums">{anime.user_score}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-auto pt-6 border-t border-[#FF3B3B]/15 flex justify-center items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={effectivePage === 1} className="p-2 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 text-zinc-500 hover:text-[#FF3B3B] disabled:opacity-30 transition-colors rounded-lg">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex gap-1 px-2">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 flex items-center justify-center font-bold text-xs transition-all rounded-lg ${effectivePage === i + 1 ? 'bg-[#FF3B3B] text-[var(--kr-text)]' : 'bg-[var(--kr-surface)] border border-[#FF3B3B]/15 text-zinc-500 hover:bg-[#FF3B3B]/10 hover:text-zinc-200'}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={effectivePage === totalPages} className="p-2 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 text-zinc-500 hover:text-[#FF3B3B] disabled:opacity-30 transition-colors rounded-lg">
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
