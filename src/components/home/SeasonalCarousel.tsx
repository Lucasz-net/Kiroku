import { useEffect, useRef, useState } from 'react';
import { Tv, ChevronRight, Calendar, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Anime } from '../../types/anime';
import { AnimeCard } from '../AnimeCard';
import { getCurrentSeason } from '../../services/jikanApi';

interface SeasonalCarouselProps {
  upcoming: Anime[];
  hasError?: boolean;
  onRetry?: () => void;
}

const SkeletonAnimeCard = () => (
  <div className="w-56 shrink-0">
    <div className="aspect-[3/4] bg-[var(--kr-surface-2)] rounded-xl animate-pulse border border-[#FF3B3B]/[0.05]" />
    <div className="pt-3 flex flex-col gap-2">
      <div className="h-3.5 bg-[var(--kr-surface-2)] rounded animate-pulse w-4/5" />
      <div className="h-2.5 bg-[var(--kr-surface-2)] rounded animate-pulse w-2/5" />
    </div>
  </div>
);

// NUEVO: Tipado estricto para evitar el uso de 'any'
type Season = 'winter' | 'spring' | 'summer' | 'fall';

const getNextSeasonInfo = (year: number, season: string) => {
  const seasonsOrder: Season[] = ['winter', 'spring', 'summer', 'fall'];
  const labels: Record<Season, string> = { winter: 'INVIERNO', spring: 'PRIMAVERA', summer: 'VERANO', fall: 'OTOÑO' };
  
  const idx = seasonsOrder.indexOf(season as Season);
  if (idx === -1) return { year, season: 'winter', label: 'INVIERNO' }; // Fallback de seguridad
  
  if (idx === 3) {
    return { year: year + 1, season: 'winter', label: labels['winter'] };
  }
  const nextSeason = seasonsOrder[idx + 1];
  return { year, season: nextSeason, label: labels[nextSeason] };
};

export const SeasonalCarousel = ({ upcoming, hasError, onRetry }: SeasonalCarouselProps) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isHovered = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const [isDraggingUI, setIsDraggingUI] = useState(false);

  const { year, label, season } = getCurrentSeason();
  const nextSeason = getNextSeasonInfo(year, season); // Calculamos la próxima temporada
  const isLoading = upcoming.length === 0;

  useEffect(() => {
    let animId: number;
    const step = () => {
      const el = carouselRef.current;
      if (el && !isDragging.current && !isHovered.current) {
        el.scrollLeft += 1;
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
      }
      animId = requestAnimationFrame(step);
    };
    if (!isLoading) animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [upcoming, isLoading]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !carouselRef.current) return;
      const walk = (e.clientX - startX.current) * 1.5;
      carouselRef.current.scrollLeft = scrollLeftPos.current - walk;
      if (Math.abs(walk) > 4) setIsDraggingUI(true);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setTimeout(() => setIsDraggingUI(false), 50);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current || isLoading) return;
    isDragging.current = true;
    startX.current = e.clientX;
    scrollLeftPos.current = carouselRef.current.scrollLeft;
  };

  const handleMouseEnter = () => { isHovered.current = true; };
  const handleMouseLeave = () => { isHovered.current = false; };

  return (
    <section className="estrenos-section reveal-section relative z-20 bg-[var(--kr-surface)] -mt-[120px] pt-[160px] pb-40">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/15 to-transparent" />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 z-0"
        style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(255,59,59,0.055) 0%, transparent 70%)' }}
      />

      <div className="section-content relative z-10">
        <div className="container mx-auto px-4 md:px-8 max-w-[1400px] mb-8">
          <p className="seasonal-label text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2 leading-none">
            <Tv size={15} className="text-[#FF3B3B]/50 shrink-0" /> Esta temporada
          </p>
          <div className="seasonal-title flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <h2 className="text-3xl md:text-5xl font-black text-[var(--kr-text)] tracking-tight leading-none">
                Estrenos
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 border border-[#FF3B3B]/20 bg-[var(--kr-surface)] px-3 py-1.5 rounded-lg mb-0.5">
                {label} {year}
              </span>
            </div>
            <Link
              to="/seasonal"
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] transition-colors duration-200 mb-0.5 shrink-0"
            >
              Ver todo <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        <div className="seasonal-carousel relative w-full mb-10">
          <div
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`flex gap-5 overflow-x-auto px-6 md:px-8 pb-6 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none ${!isLoading && isDraggingUI ? 'cursor-grabbing' : !isLoading ? 'cursor-grab' : ''}`}
          >
            {hasError ? (
              <div className="flex flex-col items-center gap-3 py-10 w-full text-center">
                <p className="text-zinc-500 text-sm font-bold">No se pudieron cargar los estrenos.</p>
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-5 py-2 border border-[#FF3B3B]/20 bg-[var(--kr-surface-sunken)] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-[var(--kr-text)] hover:border-[#FF3B3B] transition-all rounded-xl"
                >
                  <RefreshCw size={13} /> Reintentar
                </button>
              </div>
            ) : isLoading
              ? [...Array(8)].map((_, i) => <SkeletonAnimeCard key={i} />)
              : [...upcoming, ...upcoming].map((anime, index) => (
                  <div
                    key={`${anime.mal_id}-${index}`}
                    className={`inline-block w-56 shrink-0 transition-transform duration-200 ${isDraggingUI ? 'pointer-events-none scale-[0.98] opacity-75' : ''}`}
                  >
                    <AnimeCard anime={anime} />
                  </div>
                ))
            }
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-[var(--kr-surface)] via-[var(--kr-surface)]/60 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-[var(--kr-surface)] via-[var(--kr-surface)]/60 to-transparent z-10" />
        </div>

        {/* ── NUEVO COMPONENTE INTEGRADO (Sin romper la animación GSAP) ── */}
        <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">
          <Link 
            to={`/seasonal?year=${nextSeason.year}&season=${nextSeason.season}`}
            className="group block relative w-full bg-[var(--kr-glass-3)] backdrop-blur-sm border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 rounded-2xl p-6 md:p-8 overflow-hidden transition-all duration-300 shadow-md"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 text-[#FF3B3B] rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Calendar size={22} />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    Próxima parada
                  </p>
                  <h3 className="text-xl md:text-2xl font-black text-[var(--kr-text)] tracking-tight">
                    Ver estrenos de la siguiente temporada:{' '}
                    <span className="text-[#FF3B3B] group-hover:text-[#FF5555] transition-colors">
                      {nextSeason.label} {nextSeason.year}
                    </span>
                  </h3>
                </div>
              </div>
              
              <div className="flex items-center gap-2 self-end sm:self-center bg-[var(--kr-surface)] border border-[#FF3B3B]/15 group-hover:bg-[#FF3B3B] group-hover:text-[var(--kr-text)] group-hover:border-[#FF3B3B] text-zinc-400 px-5 py-2.5 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all duration-300">
                Explorar <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

      </div>
    </section>
  );
};