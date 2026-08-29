import { useState, useEffect, useCallback, useRef } from 'react';
import { prefersReducedMotion } from '../utils/motion';
import { useSearchParams } from 'react-router-dom'; // <-- NUEVO
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Plus } from 'lucide-react';
import { getCurrentSeason, getSeasonLabel } from '../services/jikanApi';
import { getSeasonAniList } from '../services/aniListApi';
import type { Anime } from '../types/anime';
import { AnimeCard } from '../components/AnimeCard';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
type Season = typeof SEASONS[number];

const getPrevSeason = (year: number, season: Season): { year: number; season: Season } => {
  const idx = SEASONS.indexOf(season);
  if (idx === 0) return { year: year - 1, season: 'fall' };
  return { year, season: SEASONS[idx - 1] };
};

const getNextSeason = (year: number, season: Season): { year: number; season: Season } => {
  const idx = SEASONS.indexOf(season);
  if (idx === 3) return { year: year + 1, season: 'winter' };
  return { year, season: SEASONS[idx + 1] };
};

// Modificado: Ahora el límite máximo permitido es exactamente la Siguiente Temporada
const isSeasonBeyondNext = (year: number, season: Season): boolean => {
  const current = getCurrentSeason();
  const next = getNextSeason(current.year, current.season as Season);
  
  if (year > next.year) return true;
  if (year === next.year) return SEASONS.indexOf(season) > SEASONS.indexOf(next.season);
  return false;
};

const TYPE_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'TV', value: 'tv' },
  { label: 'Película', value: 'movie' },
  { label: 'OVA', value: 'ova' },
  { label: 'Especial', value: 'special' },
];

const TYPE_TO_ANILIST_FORMATS: Record<string, string[]> = {
  tv: ['TV', 'TV_SHORT'],
  movie: ['MOVIE'],
  ova: ['OVA'],
  special: ['SPECIAL'],
};

const SkeletonCard = () => (
  <div className="flex flex-col gap-2 animate-pulse">
    <div className="aspect-[3/4] bg-[#1A1C24] rounded-xl border border-[#FF3B3B]/[0.05]" />
    <div className="h-3.5 bg-[#1A1C24] rounded-lg w-4/5" />
    <div className="h-2.5 bg-[#1A1C24] rounded-lg w-2/5" />
  </div>
);

export const SeasonalPage = () => {
  const [searchParams, setSearchParams] = useSearchParams(); // <-- NUEVO
  const current = getCurrentSeason();
  
  // Inicializa leyendo la URL si existen parámetros; de lo contrario, usa la temporada actual
  const initialYear = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : current.year;
  const initialSeason = (searchParams.get('season') as Season) || (current.season as Season);

  const [year, setYear] = useState(initialYear);
  const [season, setSeason] = useState<Season>(initialSeason);
  const [typeFilter, setTypeFilter] = useState('');
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchIdRef  = useRef(0);
  const headerRef   = useRef<HTMLDivElement>(null);

  useDocumentTitle(`${getSeasonLabel(season)} ${year}`);

  // Sincroniza los estados internos si los parámetros de la URL cambian externamente
  useEffect(() => {
    const urlYear = searchParams.get('year');
    const urlSeason = searchParams.get('season') as Season;
    if (urlYear) setYear(parseInt(urlYear, 10));
    if (urlSeason && SEASONS.includes(urlSeason)) setSeason(urlSeason);
  }, [searchParams]);

  useGSAP(() => {
    // Sin animaciones de entrada si el sistema pidió reducir el movimiento:
    // GSAP es quien pone el estado inicial, así que salir acá deja los
    // elementos directamente en su estado final. Ver utils/motion.ts.
    if (prefersReducedMotion()) return;
    gsap.fromTo('.sea-label', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power4.out' });
    gsap.fromTo('.sea-title', { opacity: 0, y: 22, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power4.out', delay: 0.08 });
    gsap.fromTo('.sea-nav', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.18 });
  }, { scope: headerRef, dependencies: [year, season] });

  const fetchAnimes = useCallback(async (
    y: number, s: Season, t: string, p: number, append = false
  ) => {
    const id = ++fetchIdRef.current;
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await getSeasonAniList(y, s, p, TYPE_TO_ANILIST_FORMATS[t]);
      if (id !== fetchIdRef.current) return;
      const items = res?.data ?? [];
      setAnimes(prev => {
        const combined = append ? [...prev, ...items] : items;
        const seen = new Set<number>();
        return combined.filter(a => seen.has(a.mal_id) ? false : (seen.add(a.mal_id), true));
      });
      setHasMore(res?.hasNextPage ?? false);
    } catch {
      if (id !== fetchIdRef.current) return;
      if (!append) setAnimes([]);
      setHasMore(false);
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setAnimes([]);
    fetchAnimes(year, season, typeFilter, 1, false);
  }, [year, season, typeFilter, fetchAnimes]);

  const navigateSeason = (dir: 'prev' | 'next') => {
    const nav = dir === 'prev' ? getPrevSeason(year, season) : getNextSeason(year, season);
    setYear(nav.year);
    setSeason(nav.season);
    // Setea los parámetros en la URL para mantener el historial sincronizado
    setSearchParams({ year: nav.year.toString(), season: nav.season });
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchAnimes(year, season, typeFilter, next, true);
  };

  const next = getNextSeason(year, season);
  // Usa la nueva regla de validación de límite
  const canGoNext = !isSeasonBeyondNext(next.year, next.season);

  return (
    <div className="min-h-screen bg-[#080A0F] pt-28 md:pt-32 pb-24 px-4 font-sans">
      <div ref={headerRef} className="container mx-auto max-w-[1400px]">

        {/* ── Header ── */}
        <div className="mb-10">
          <p className="sea-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <CalendarDays size={15} className="text-[#FF3B3B]/50" />
            Temporada
          </p>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="sea-title text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
              {getSeasonLabel(season)}{' '}
              <span className="text-zinc-600">{year}</span>
            </h1>

            {/* Navegación de temporada */}
            <div className="sea-nav flex items-center gap-2">
              <button
                onClick={() => navigateSeason('prev')}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#FF3B3B]/20 bg-[#11131A] text-zinc-400 font-bold text-[11px] uppercase tracking-widest hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                onClick={() => navigateSeason('next')}
                disabled={!canGoNext}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#FF3B3B]/20 bg-[#11131A] text-zinc-400 font-bold text-[11px] uppercase tracking-widest hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Filtros de tipo ── */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all ${
                typeFilter === f.value
                  ? 'bg-[#FF3B3B] text-white border-[#FF3B3B]'
                  : 'bg-[#11131A] text-zinc-500 border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {loading
            ? [...Array(18)].map((_, i) => <SkeletonCard key={i} />)
            : animes.map(anime => <AnimeCard key={anime.mal_id} anime={anime} />)
          }
        </div>

        {/* ── Empty state ── */}
        {!loading && animes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="opacity-20">
              <rect x="8" y="10" width="56" height="52" rx="6" stroke="#FF3B3B" strokeWidth="2.5" />
              <path d="M8 22h56" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 10v12M50 10v12" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
              <path d="M24 40h24M24 50h16" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-zinc-400 text-base font-black">Sin resultados</p>
            <p className="text-zinc-600 text-sm">No hay animes para esta temporada con los filtros seleccionados.</p>
          </div>
        )}

        {/* ── Load more ── */}
        {!loading && hasMore && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2.5 border border-[#FF3B3B]/20 bg-[#11131A] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all disabled:opacity-40 rounded-xl"
            >
              {loadingMore
                ? <><Loader2 size={14} className="animate-spin" /> Cargando...</>
                : <><Plus size={14} /> Cargar más</>
              }
            </button>
          </div>
        )}

      </div>
    </div>
  );
};