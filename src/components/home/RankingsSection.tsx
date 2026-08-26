import { Link } from 'react-router-dom';
import { Star, Flame, RefreshCw } from 'lucide-react';
import type { Anime } from '../../types/anime';
import { RankingRow } from './RankingRow';

interface RankingsSectionProps {
  topRated: Anime[];
  topPopular: Anime[];
  topRatedError?: boolean;
  topPopularError?: boolean;
  onRetry?: () => void;
}

const ErrorState = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="flex flex-col items-center gap-3 py-10 text-center">
    <p className="text-zinc-500 text-sm font-bold">No se pudo cargar el ranking.</p>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-5 py-2 border border-[#FF3B3B]/20 bg-[#0D0F15] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl"
    >
      <RefreshCw size={13} /> Reintentar
    </button>
  </div>
);

const SkeletonRow = () => (
  <div className="flex bg-[#0D0F15] rounded-xl border border-[#FF3B3B]/[0.07] overflow-hidden animate-pulse">
    <div className="w-14 bg-[#1A1C24] shrink-0" />
    <div className="w-24 md:w-28 h-32 md:h-36 bg-[#1A1C24] shrink-0" />
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

export const RankingsSection = ({ topRated, topPopular, topRatedError, topPopularError, onRetry }: RankingsSectionProps) => (
  <section className="rankings-section reveal-section relative z-30 bg-[#0D0F15] -mt-[120px] pt-24 pb-32 px-4">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/10 to-transparent" />

    <div className="section-content container mx-auto max-w-[1400px]">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Top 10 Animes ── */}
        <div className="ranking-card-left bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />

          <p className="ranking-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Star size={15} className="text-[#FF3B3B]/50" /> Mejor puntuados
          </p>
          <h2 className="ranking-title text-2xl md:text-3xl font-black text-white mb-6 tracking-tight">
            Top 10 Animes
          </h2>

          <div className="flex flex-col gap-3">
            {topRated.length > 0
              ? topRated.map((anime, index) => <RankingRow key={anime.mal_id} anime={anime} index={index} />)
              : topRatedError
                ? <ErrorState onRetry={onRetry} />
                : [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            }
          </div>

          <div className="mt-6 pt-6 border-t border-[#FF3B3B]/10 flex justify-center">
            <Link
              to="/top/rated"
              className="px-6 py-2.5 border border-[#FF3B3B]/20 bg-[#0D0F15] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl"
            >
              Ranking Completo
            </Link>
          </div>
        </div>

        {/* ── Más Populares ── */}
        <div className="ranking-card-right bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />

          <p className="ranking-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Flame size={15} className="text-[#FF3B3B]/50" /> Tendencias
          </p>
          <h2 className="ranking-title text-2xl md:text-3xl font-black text-white mb-6 tracking-tight">
            Más Populares
          </h2>

          <div className="flex flex-col gap-3">
            {topPopular.length > 0
              ? topPopular.map((anime, index) => <RankingRow key={anime.mal_id} anime={anime} index={index} />)
              : topPopularError
                ? <ErrorState onRetry={onRetry} />
                : [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            }
          </div>

          <div className="mt-6 pt-6 border-t border-[#FF3B3B]/10 flex justify-center">
            <Link
              to="/top/popular"
              className="px-6 py-2.5 border border-[#FF3B3B]/20 bg-[#0D0F15] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-white hover:border-[#FF3B3B] transition-all rounded-xl"
            >
              Ranking Completo
            </Link>
          </div>
        </div>

      </div>
    </div>
  </section>
);
