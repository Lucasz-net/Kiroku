import { useEffect, useState, useMemo, useRef } from 'react';
import { SavedAnimeCover } from '../components/SavedAnimeCover';
import { UpcomingEpisodes } from '../components/UpcomingEpisodes';
import { prefersReducedMotion } from '../utils/motion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUserData } from '../contexts/UserDataContext';
import {
  BookmarkCheck, Eye, Clock, Heart, List, Search,
  Star, LayoutGrid, AlignJustify, ArrowUpDown, X, type LucideIcon,
} from 'lucide-react';
import { translateGenre } from '../utils/translations';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const TABS = [
  { id: 'Todos',      icon: List,          label: 'Todos' },
  { id: 'Completado', icon: BookmarkCheck, label: 'Completados' },
  { id: 'Mirando',    icon: Eye,           label: 'Mirando' },
  { id: 'Pendiente',  icon: Clock,         label: 'Pendientes' },
  { id: 'Favoritos',  icon: Heart,         label: 'Favoritos' },
];

const STATUS_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  Completado: { icon: BookmarkCheck, color: 'text-[#FF3B3B]' },
  Mirando:    { icon: Eye,           color: 'text-[#FF7777]' },
  Pendiente:  { icon: Clock,         color: 'text-[#FF9B9B]' },
};

const SORT_OPTIONS = [
  { value: 'recent',     label: 'Más recientes' },
  { value: 'score_desc', label: 'Mayor puntuación' },
  { value: 'score_asc',  label: 'Menor puntuación' },
  { value: 'az',         label: 'A → Z' },
  { value: 'za',         label: 'Z → A' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['value'];

const WatchlistSkeleton = () => (
  <div className="min-h-screen bg-[var(--kr-bg)] pt-28 md:pt-32 pb-24 font-sans">
    <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">
      <div className="mb-10">
        <div className="h-2.5 w-20 bg-[var(--kr-surface)] rounded-full animate-pulse mb-3" />
        <div className="h-10 w-48 bg-[var(--kr-surface)] rounded-xl animate-pulse" />
      </div>
      <div className="flex gap-2 mb-4 overflow-hidden">
        {[...Array(5)].map((_, i) => <div key={i} className="h-9 w-28 shrink-0 bg-[var(--kr-surface)] rounded-xl animate-pulse" />)}
      </div>
      <div className="flex gap-2 mb-8">
        <div className="h-9 flex-1 bg-[var(--kr-surface)] rounded-xl animate-pulse" />
        <div className="h-9 w-32 bg-[var(--kr-surface)] rounded-xl animate-pulse" />
        <div className="h-9 w-9 bg-[var(--kr-surface)] rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-[var(--kr-surface)] rounded-xl overflow-hidden border border-[#FF3B3B]/10 animate-pulse">
            <div className="aspect-[3/4] bg-[var(--kr-surface-sunken)]" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-[var(--kr-surface-sunken)] rounded w-4/5" />
              <div className="h-2.5 bg-[var(--kr-surface-sunken)] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const WatchlistEmpty = () => (
  <div className="col-span-full flex flex-col items-center py-24 gap-4 text-center">
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-20">
      <rect x="14" y="8" width="42" height="64" rx="6" stroke="#FF3B3B" strokeWidth="2.5" />
      <line x1="24" y1="24" x2="46" y2="24" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="34" x2="46" y2="34" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="44" x2="38" y2="44" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <p className="text-zinc-300 text-xl font-black">Lista vacía</p>
    <p className="text-zinc-600 text-sm">Agrega animes desde su página de detalles para verlos aquí.</p>
    <Link to="/search" className="mt-2 flex items-center gap-2 px-6 py-3 bg-[#FF3B3B] text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors">
      <Search size={14} /> Explorar
    </Link>
  </div>
);

export const WatchlistPage = () => {
  // La lista sale del contexto, que ya la mantiene sincronizada: antes esta
  // página repetía el mismo select más un getSession() propio en cada visita.
  // De paso desaparece la carrera con la inicialización de auth.
  const { savedAnimes, session, authReady } = useUserData();
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sortRef   = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useDocumentTitle('Mi Watchlist');

  const animes = useMemo(
    () => [...savedAnimes].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [savedAnimes],
  );
  const loading = !authReady;

  useEffect(() => {
    if (authReady && !session) navigate('/');
  }, [authReady, session, navigate]);

  // Anima el título cuando la página termina de cargar (se repite en cada visita)
  useGSAP(() => {
    // Sin animaciones de entrada si el sistema pidió reducir el movimiento:
    // GSAP es quien pone el estado inicial, así que salir acá deja los
    // elementos directamente en su estado final. Ver utils/motion.ts.
    if (prefersReducedMotion()) return;
    if (loading) return;
    gsap.fromTo('.wl-label',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power4.out' }
    );
    gsap.fromTo('.wl-title',
      { opacity: 0, y: 22, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power4.out', delay: 0.08 }
    );
  }, { scope: headerRef, dependencies: [loading] });

  // ── Filtros leídos directamente desde la URL ──────────────────────────────
  const activeTab   = searchParams.get('tab')  ?? 'Todos';
  const searchQ     = searchParams.get('q')    ?? '';
  const sortKey     = (searchParams.get('sort') as SortKey) ?? 'recent';
  const viewMode    = (searchParams.get('view') as 'grid' | 'list') ?? 'grid';
  const selectedGenres = useMemo(
    () => searchParams.get('genres')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );

  // ── Helper para actualizar un param sin crear nueva entrada en historial ──
  const setParam = (key: string, value: string | null, defaultVal = '') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === defaultVal) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    animes.forEach(a => a.genres?.forEach(g => set.add(g)));
    return Array.from(set).sort();
  }, [animes]);

  const toggleGenre = (genre: string) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter(g => g !== genre)
      : [...selectedGenres, genre];
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next.length === 0) p.delete('genres');
      else p.set('genres', next.join(','));
      return p;
    }, { replace: true });
  };

  const clearGenres = () => setParam('genres', null);

  const filtered = useMemo(() => {
    let list = animes;

    if (activeTab === 'Favoritos') list = list.filter(a => a.is_favorite);
    else if (activeTab !== 'Todos') list = list.filter(a => a.status === activeTab);

    if (searchQ.trim()) list = list.filter(a => a.title.toLowerCase().includes(searchQ.toLowerCase()));

    if (selectedGenres.length > 0) {
      list = list.filter(a => selectedGenres.some(g => a.genres?.includes(g)));
    }

    const sorted = [...list];
    switch (sortKey) {
      case 'score_desc':
        sorted.sort((a, b) => {
          if (a.score == null && b.score == null) return 0;
          if (a.score == null) return 1;
          if (b.score == null) return -1;
          return b.score - a.score;
        });
        break;
      case 'score_asc':
        sorted.sort((a, b) => {
          if (a.score == null && b.score == null) return 0;
          if (a.score == null) return 1;
          if (b.score == null) return -1;
          return a.score - b.score;
        });
        break;
      case 'az':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'za':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        break;
    }

    return sorted;
  }, [animes, activeTab, searchQ, selectedGenres, sortKey]);

  const counts = useMemo(() => ({
    Todos:      animes.length,
    Completado: animes.filter(a => a.status === 'Completado').length,
    Mirando:    animes.filter(a => a.status === 'Mirando').length,
    Pendiente:  animes.filter(a => a.status === 'Pendiente').length,
    Favoritos:  animes.filter(a => a.is_favorite).length,
  }), [animes]);

  const currentSortLabel = SORT_OPTIONS.find(s => s.value === sortKey)?.label ?? 'Ordenar';
  const hasActiveGenres  = selectedGenres.length > 0;
  const hasActiveFilters = hasActiveGenres || sortKey !== 'recent' || searchQ.trim().length > 0;

  if (loading) return <WatchlistSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--kr-bg)] pt-28 md:pt-32 pb-24 font-sans">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">

        {/* Header */}
        <div ref={headerRef} className="mb-10">
          <p className="wl-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <List size={15} className="text-[#FF3B3B]/50" /> Mi Colección
          </p>
          <h1 className="wl-title text-4xl md:text-6xl font-black text-[var(--kr-text)] tracking-tight leading-none">
            Watchlist
          </h1>
        </div>

        {/* Lo primero que se ve: qué sale y cuándo, de lo que estás mirando.
            Se oculta sola si nada de la lista está en emisión. */}
        <UpcomingEpisodes animes={animes} />

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setParam('tab', tab.id, 'Todos')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#FF3B3B] text-[var(--kr-text)] border-[#FF3B3B]'
                  : 'bg-[var(--kr-surface)] text-zinc-500 border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
              <span className={`text-[11px] tabular-nums ${activeTab === tab.id ? 'text-[var(--kr-text)]/70' : 'text-zinc-600'}`}>
                {counts[tab.id as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort + Toggle */}
        <div className={`flex flex-col sm:flex-row gap-3 ${availableGenres.length > 0 ? 'mb-4' : 'mb-8'}`}>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQ}
            onChange={e => setParam('q', e.target.value)}
            className="flex-1 px-4 py-2 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 focus:border-[#FF3B3B] focus:outline-none text-[var(--kr-text)] text-xs font-bold rounded-xl placeholder:text-zinc-600 transition-all"
          />
          <div className="flex gap-2 shrink-0">
            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setShowSortDropdown(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 border text-xs font-bold uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                  sortKey !== 'recent'
                    ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/40 text-[#FF3B3B]'
                    : 'bg-[var(--kr-surface)] border-[#FF3B3B]/15 text-zinc-400 hover:text-zinc-200 hover:border-[#FF3B3B]/30'
                }`}
              >
                <ArrowUpDown size={13} />
                <span className="hidden sm:inline">{currentSortLabel}</span>
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-2 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-50 min-w-44 rounded-xl overflow-hidden">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setParam('sort', opt.value, 'recent'); setShowSortDropdown(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors hover:bg-[var(--kr-surface)] border-b border-[#FF3B3B]/[0.07] last:border-0 ${
                        sortKey === opt.value ? 'text-[#FF3B3B] bg-[var(--kr-glass-2)]' : 'text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid/list toggle */}
            <button
              onClick={() => setParam('view', viewMode === 'grid' ? 'list' : 'grid', 'grid')}
              title={viewMode === 'grid' ? 'Vista lista' : 'Vista grid'}
              className="px-3 py-2 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 text-zinc-500 hover:text-zinc-200 rounded-xl transition-all shrink-0"
            >
              {viewMode === 'grid' ? <AlignJustify size={16} /> : <LayoutGrid size={16} />}
            </button>
          </div>
        </div>

        {/* Genre chips */}
        {availableGenres.length > 0 && (
          <div className="mb-8">
            {/* Header: label + limpiar (siempre visible fuera del scroll) */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Categorías
              </span>
              {hasActiveGenres && (
                <button
                  onClick={clearGenres}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] transition-colors"
                >
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>

            {/* Chips scrolleables */}
            <div className="relative">
              <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5">
                <button
                  onClick={clearGenres}
                  className={`shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border rounded-lg transition-all ${
                    !hasActiveGenres
                      ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/60 text-[#FF3B3B]'
                      : 'bg-[var(--kr-surface-sunken)] border-[#FF3B3B]/[0.07] text-zinc-500 hover:border-[#FF3B3B]/30 hover:text-[var(--kr-text)]'
                  }`}
                >
                  Todos
                </button>
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border rounded-lg transition-all whitespace-nowrap ${
                      selectedGenres.includes(genre)
                        ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/60 text-[#FF3B3B]'
                        : 'bg-[var(--kr-surface-sunken)] border-[#FF3B3B]/[0.07] text-zinc-500 hover:border-[#FF3B3B]/30 hover:text-[var(--kr-text)]'
                    }`}
                  >
                    {translateGenre(genre)}
                  </button>
                ))}
              </div>
              {/* Gradiente indicador de scroll — solo mobile */}
              <div className="md:hidden absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--kr-bg)] to-transparent pointer-events-none" />
            </div>

            {/* Texto indicador de scroll — solo mobile */}
            <p className="md:hidden mt-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-700 flex items-center gap-1">
              <span>←</span> Desliza para ver más categorías <span>→</span>
            </p>
          </div>
        )}

        {/* Contador cuando hay filtros activos */}
        {hasActiveFilters && (
          <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mb-4 tabular-nums">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <WatchlistEmpty />
          </div>
        ) : viewMode === 'list' ? (
          /* ── Vista lista ── */
          <div className="flex flex-col gap-2">
            {filtered.map(anime => {
              const cfg = STATUS_ICON[anime.status];
              const Icon = cfg?.icon ?? Clock;
              const color = cfg?.color ?? 'text-zinc-500';
              return (
                <Link
                  key={anime.id}
                  to={`/anime/${anime.anime_id}`}
                  className="group flex items-center gap-4 p-3 bg-[var(--kr-surface)] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 rounded-xl transition-all"
                >
                  <SavedAnimeCover
                    animeId={anime.anime_id}
                    title={anime.title}
                    imageUrl={anime.image_url}
                    rowId={anime.id}
                    className="w-11 h-16 shrink-0 overflow-hidden rounded-lg opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[var(--kr-text)] text-sm font-bold truncate group-hover:text-[#FF3B3B] transition-colors mb-1">{anime.title}</h4>
                    <span className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide ${color}`}>
                      <Icon size={11} />{anime.status}
                    </span>
                    {anime.genres && anime.genres.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {anime.genres.slice(0, 3).map(g => (
                          <span key={g} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            selectedGenres.includes(g)
                              ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/30 text-[#FF7777]'
                              : 'bg-[var(--kr-surface-sunken)] border-[#FF3B3B]/[0.07] text-zinc-600'
                          }`}>
                            {translateGenre(g)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {anime.is_favorite && <Heart size={13} className="fill-[#FF3B3B] text-[#FF3B3B]" />}
                    {anime.user_score != null && (
                      <div className="flex items-center gap-0.5 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 px-2 py-1 rounded-lg">
                        <Star size={11} className="fill-[#FF3B3B] text-[#FF3B3B]" />
                        <span className="text-[var(--kr-text)] text-xs font-black tabular-nums">{anime.user_score}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── Vista grid ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {filtered.map(anime => (
              <Link
                key={anime.id}
                to={`/anime/${anime.anime_id}`}
                className="group relative bg-[var(--kr-surface)] overflow-hidden rounded-xl border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 transition-[border-color] duration-500"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <SavedAnimeCover
                    animeId={anime.anime_id}
                    title={anime.title}
                    imageUrl={anime.image_url}
                    rowId={anime.id}
                    className="w-full h-full transition-opacity duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--kr-surface)] via-transparent to-transparent opacity-90" />
                  <div className="absolute bottom-0 left-0 w-full p-3">
                    <h4 className="text-[var(--kr-text)] text-xs font-bold line-clamp-2 leading-tight mb-1.5 group-hover:text-[#FF3B3B] transition-colors">
                      {anime.title}
                    </h4>
                    {(() => {
                      const cfg = STATUS_ICON[anime.status];
                      const Icon = cfg?.icon ?? Clock;
                      const color = cfg?.color ?? 'text-zinc-500';
                      return (
                        <span className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${color}`}>
                          <Icon size={11} />
                          {anime.status}
                        </span>
                      );
                    })()}
                  </div>
                  {anime.is_favorite && (
                    <div className="absolute top-2 left-2 w-7 h-7 bg-[var(--kr-glass-2)] backdrop-blur-sm flex items-center justify-center border border-[#FF3B3B]/15 rounded-lg">
                      <Heart size={12} className="fill-[#FF3B3B] text-[#FF7777]" />
                    </div>
                  )}
                  {anime.user_score != null && (
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-[var(--kr-glass-1)] backdrop-blur-sm border border-[#FF3B3B]/20 px-1.5 py-1 rounded-md">
                      <Star size={11} className="fill-[#FF3B3B] text-[#FF3B3B]" />
                      <span className="text-[var(--kr-text)] text-xs font-black tabular-nums">{anime.user_score}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
