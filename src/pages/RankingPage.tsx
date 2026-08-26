import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTopRatedAniList, getTopPopularAniList } from '../services/aniListApi';
import type { Anime } from '../types/anime';
import { Flame, Star, Loader2, RefreshCw } from 'lucide-react';
import { RankingRow } from '../components/home/RankingRow';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const MODES = [
  {
    filter:  '',
    path:    '/top/rated',
    label:   'Mejor Valoradas',
    sub:     'Por puntuación MAL',
    icon:    Star,
  },
  {
    filter:  'bypopularity',
    path:    '/top/popular',
    label:   'Más Populares',
    sub:     'Por votos de usuarios',
    icon:    Flame,
  },
] as const;

const SkeletonRow = () => (
  <div className="flex bg-[#0D0F15] rounded-xl border border-[#FF3B3B]/[0.07] overflow-hidden animate-pulse">
    <div className="w-14 bg-[#1A1C24] shrink-0" />
    <div className="w-28 md:w-40 h-40 md:h-52 bg-[#1A1C24] shrink-0" />
    <div className="p-4 md:p-5 flex flex-col justify-center flex-1 gap-3">
      <div className="h-4 bg-[#1A1C24] rounded-lg w-3/4" />
      <div className="flex gap-2">
        <div className="h-3 bg-[#1A1C24] rounded-lg w-16" />
        <div className="h-3 bg-[#1A1C24] rounded-lg w-16" />
      </div>
      <div className="h-3 bg-[#1A1C24] rounded-lg w-28" />
    </div>
  </div>
);

export const RankingPage = () => {
  const { filter } = useParams();
  const navigate   = useNavigate();

  const [animes, setAnimes]           = useState<Anime[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [loadError, setLoadError]     = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headerRef   = useRef<HTMLDivElement>(null);
  const animesLenRef = useRef(0);

  useGSAP(() => {
    gsap.fromTo('.rk-label',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power4.out' }
    );
    gsap.fromTo('.rk-title',
      { opacity: 0, y: 22, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power4.out', delay: 0.08 }
    );
    gsap.fromTo('.rk-selector',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.18 }
    );
  }, { scope: headerRef });

  const isPopular   = filter === 'popular';
  const activeMode  = isPopular ? MODES[1] : MODES[0];
  useDocumentTitle(activeMode.label);

  const fetchRankings = useCallback(async (page: number, append = false) => {
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await (isPopular ? getTopPopularAniList(page) : getTopRatedAniList(page));
      const newAnimes = res?.data || [];
      const totalLen = (append ? animesLenRef.current : 0) + newAnimes.length;
      animesLenRef.current = totalLen;
      setAnimes(prev => append ? [...prev, ...newAnimes] : newAnimes);
      setHasMore(newAnimes.length === 25 && totalLen < 100);
      setLoadError(false);
    } catch (error) {
      console.error(error);
      if (!append) { setAnimes([]); animesLenRef.current = 0; }
      setHasMore(false);
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isPopular]);

  useEffect(() => {
    setCurrentPage(1);
    setAnimes([]);
    animesLenRef.current = 0;
    setHasMore(true);
    fetchRankings(1, false);
    window.scrollTo(0, 0);
  }, [filter, isPopular, fetchRankings]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !loading && hasMore && animes.length < 100) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          fetchRankings(nextPage, true);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentPage, loadingMore, loading, hasMore, animes.length, fetchRankings]);

  return (
    <div className="min-h-screen bg-[#080A0F] pt-28 md:pt-32 pb-24 px-4 font-sans">
      <div ref={headerRef} className="container mx-auto max-w-[860px]">

        {/* ── Header ── */}
        <div className="mb-8">
          <p className="rk-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <activeMode.icon size={15} className="text-[#FF3B3B]/50" />
            {isPopular ? 'Tendencias' : 'Mejor puntuados'}
          </p>
          <h1 className="rk-title text-4xl md:text-6xl font-black text-white tracking-tight">
            {activeMode.label}
          </h1>
        </div>

        {/* ── Selector de ranking ── */}
        <div className="rk-selector relative grid grid-cols-2 bg-[#11131A] border border-[#FF3B3B]/15 rounded-2xl p-1.5 gap-1.5 mb-8 overflow-hidden">
          {/* Hairline top accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/25 to-transparent pointer-events-none" />

          {MODES.map(mode => {
            const active = activeMode.path === mode.path;
            return (
              <button
                key={mode.path}
                onClick={() => navigate(mode.path)}
                className={`group flex items-center gap-3 px-4 md:px-6 py-4 rounded-xl transition-all duration-200 text-left ${
                  active
                    ? 'bg-[#FF3B3B] shadow-[0_4px_24px_rgba(255,59,59,0.30)]'
                    : 'hover:bg-[#0D0F15]'
                }`}
              >
                <mode.icon
                  size={22}
                  className={`shrink-0 transition-colors ${
                    active ? 'text-white' : 'text-[#FF3B3B]/35 group-hover:text-[#FF3B3B]/60'
                  }`}
                />
                <div className="min-w-0">
                  <p className={`text-xs md:text-sm font-black uppercase tracking-widest leading-tight transition-colors ${
                    active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}>
                    {mode.label}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors hidden sm:block ${
                    active ? 'text-white/55' : 'text-zinc-600 group-hover:text-zinc-500'
                  }`}>
                    {mode.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Lista ── */}
        <div className="bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-4 md:p-6 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent rounded-t-2xl" />

          <div className="flex flex-col gap-3">
            {loading
              ? [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
              : animes.map((anime, index) => (
                  <RankingRow key={`${anime.mal_id}-${index}`} anime={anime} index={index} />
                ))
            }
          </div>

          {!loading && loadError && animes.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-zinc-400 text-sm font-bold">No se pudo cargar el ranking. Puede que Jikan (la API de datos) esté temporalmente caído.</p>
              <button
                onClick={() => fetchRankings(1, false)}
                className="flex items-center gap-2 px-6 py-2.5 border border-[#FF3B3B]/20 bg-[#0D0F15] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl"
              >
                <RefreshCw size={13} /> Reintentar
              </button>
            </div>
          )}

          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[#FF3B3B]" />
            </div>
          )}

          {!loading && !hasMore && animes.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#FF3B3B]/10 text-center">
              <p className="text-zinc-600 text-[11px] font-bold uppercase tracking-widest">
                Top {animes.length} cargados
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
