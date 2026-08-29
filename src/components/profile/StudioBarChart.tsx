import { useState, useEffect } from 'react';
import { Clapperboard } from 'lucide-react';

const BAR_GRADIENTS = [
  'linear-gradient(90deg, #FF3B3B, #FF6B6B)',
  'linear-gradient(90deg, #FF5555, #FF8585)',
  'linear-gradient(90deg, #FF6B6B, #FF9B9B)',
  'linear-gradient(90deg, #FF8080, #FFB0B0)',
  'linear-gradient(90deg, #FF9B9B, #FFBFBF)',
];

const RANK_COLORS = ['#FF3B3B', '#FF6060', '#FF8080', '#FF9B9B', '#FFBBBB'];

// Spring con ligero overshoot
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
// Deceleración rápida sin overshoot — entradas de mount
const SNAPPY = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface Props {
  studios: { label: string; count: number }[];
}

export const StudioBarChart = ({ studios }: Props) => {
  const [mounted, setMounted] = useState(false);

  // RAF para disparar scaleX en el primer frame pintado
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top      = studios.slice(0, 5);
  const maxCount = top[0]?.count ?? 1;

  if (top.length === 0) {
    return (
      <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
          <Clapperboard size={14} className="text-[#FF3B3B]/60" /> Estudios Favoritos
        </p>
        <p className="text-sm text-zinc-600 text-center py-3 italic">Sin datos suficientes.</p>
      </div>
    );
  }

  return (
    <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">

      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
        <Clapperboard size={14} className="text-[#FF3B3B]/60" /> Estudios Favoritos
      </p>

      {/* Escala superior */}
      <div className="flex mb-3 ml-[calc(1.25rem+0.75rem+4rem+0.75rem)] sm:ml-[calc(1.25rem+0.75rem+6rem+0.75rem)]">
        {[0, 25, 50, 75, 100].map(tick => (
          <div key={tick} className="flex-1 text-right" style={{ width: `${tick === 0 ? 0 : 25}%` }}>
            {tick > 0 && (
              <span className="text-[9px] font-bold tabular-nums text-zinc-700">
                {Math.round((tick / 100) * maxCount)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Filas */}
      <div className="flex flex-col gap-3">
        {top.map((studio, i) => {
          const pct = (studio.count / maxCount) * 100;
          return (
            // ── Fila: nudge horizontal con spring en hover ──
            <div
              key={studio.label}
              className="group flex items-center gap-3 hover:translate-x-[3px]"
              style={{ transition: `transform 180ms ${SPRING}` }}
            >
              {/* Rank: scale spring en hover de la fila */}
              <span
                className="text-xs font-black w-5 shrink-0 tabular-nums text-right group-hover:scale-110"
                style={{
                  color:      RANK_COLORS[i],
                  transition: `transform 200ms ${SPRING}`,
                }}
              >
                #{i + 1}
              </span>

              {/* Label */}
              <span
                className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 shrink-0 truncate text-right w-16 sm:w-24"
                style={{ transition: 'color 150ms ease-out' }}
                title={studio.label}
              >
                {studio.label}
              </span>

              {/* Pista de barra */}
              <div className="flex-1 relative h-5 bg-[#0D0F15] rounded-r-lg overflow-hidden">
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {[25, 50, 75].map(tick => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 w-px bg-[#FF3B3B]/[0.06]"
                      style={{ left: `${tick}%` }}
                    />
                  ))}
                </div>

                {/* Relleno: scaleX desde 0 al montar — GPU-safe (no anima width) */}
                <div
                  className="absolute top-0 left-0 h-full rounded-r-lg"
                  style={{
                    width:           `${pct}%`,
                    background:      BAR_GRADIENTS[i],
                    opacity:         0.85,
                    transform:       mounted ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                    // Stagger escalonado por índice: cada barra entra 70ms después
                    transition:      `transform ${480 + i * 70}ms ${SNAPPY} ${i * 65}ms`,
                  }}
                />
              </div>

              {/* Conteo */}
              <span
                className="text-xs font-black tabular-nums shrink-0 w-5 text-left"
                style={{ color: RANK_COLORS[i] }}
              >
                {studio.count}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 text-right mt-4">
        animes completados
      </p>

    </div>
  );
};
