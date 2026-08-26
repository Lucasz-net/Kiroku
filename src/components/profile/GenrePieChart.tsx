import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { translateGenre } from '../../utils/translations';

const COLORS      = ['#FF3B3B', '#FF8800', '#FBBF24', '#F472B6', '#A855F7'];
const RANK_COLORS = ['#FF3B3B', '#FF8800', '#FBBF24', '#F472B6', '#A855F7'];

// Spring con ligero overshoot
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
// Deceleración rápida — entradas de mount
const SNAPPY = 'cubic-bezier(0.22, 1, 0.36, 1)';

const GAP = 0.04;

function slicePath(outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const s = startAngle + GAP / 2;
  const e = endAngle   - GAP / 2;
  if (e - s < 0.01) return '';
  const large = e - s > Math.PI ? 1 : 0;
  const cos = (a: number) => Math.cos(a - Math.PI / 2);
  const sin = (a: number) => Math.sin(a - Math.PI / 2);
  return [
    `M ${outerR * cos(s)} ${outerR * sin(s)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${outerR * cos(e)} ${outerR * sin(e)}`,
    `L ${innerR * cos(e)} ${innerR * sin(e)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${innerR * cos(s)} ${innerR * sin(s)}`,
    'Z',
  ].join(' ');
}

interface Props {
  genres: { label: string; count: number }[];
}

export const GenrePieChart = ({ genres }: Props) => {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [mounted,      setMounted]      = useState(false);

  // RAF para disparar animación de barras en el primer frame pintado
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top   = genres.slice(0, 5);
  const total = top.reduce((s, g) => s + g.count, 0);

  if (total === 0) {
    return (
      <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
          <Star size={14} className="text-[#FF3B3B]/60" /> Géneros Favoritos
        </p>
        <p className="text-sm text-zinc-600 text-center py-3 italic">Sin datos suficientes.</p>
      </div>
    );
  }

  // Ángulo acumulado de cada sector, calculado sin mutar estado entre renders
  const angleEnds = top.reduce<number[]>((ends, g, i) => {
    const prevEnd = i > 0 ? ends[i - 1] : 0;
    ends.push(prevEnd + (g.count / total) * 2 * Math.PI);
    return ends;
  }, []);

  const slices = top.map((g, i) => ({
    ...g,
    color: COLORS[i],
    pct:   Math.round((g.count / total) * 100),
    path:  slicePath(47, 16, i > 0 ? angleEnds[i - 1] : 0, angleEnds[i]),
  }));

  const maxCount = top[0]?.count ?? 1;

  return (
    <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">

      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
        <Star size={14} className="text-[#FF3B3B]/60" /> Géneros Favoritos
      </p>

      <div className="flex items-center gap-5">

        {/* ── Donut chart con hover por sector ── */}
        <div className="shrink-0 w-[144px] h-[144px]">
          <svg
            viewBox="-50 -50 100 100"
            className="w-full h-full overflow-visible"
            onMouseLeave={() => setHoveredSlice(null)}
          >
            <defs>
              {slices.map((_, i) => (
                <filter key={i} id={`glow-g-${i}`} x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>

            {slices.map((s, i) => {
              const isHovered = hoveredSlice === i;
              const isDimmed  = hoveredSlice !== null && !isHovered;
              return (
                <path
                  key={i}
                  d={s.path}
                  fill={s.color}
                  filter={`url(#glow-g-${i})`}
                  // scale desde el centro del SVG (0,0) — spring con ligero overshoot
                  style={{
                    transform:       isHovered ? 'scale(1.07)' : 'scale(1)',
                    transformOrigin: '0 0',
                    opacity:         isDimmed ? 0.4 : 0.90,
                    cursor:          'default',
                    transition:      `transform 200ms ${SPRING}, opacity 180ms ease-out`,
                  }}
                  onMouseEnter={() => setHoveredSlice(i)}
                />
              );
            })}
          </svg>
        </div>

        {/* ── Leyenda sincronizada con el gráfico ── */}
        <div
          className="flex-1 flex flex-col gap-2.5 min-w-0"
          onMouseLeave={() => setHoveredSlice(null)}
        >
          {slices.map((s, i) => {
            const isActive = hoveredSlice === i;
            const isDimmed = hoveredSlice !== null && !isActive;
            return (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredSlice(i)}
                style={{
                  transform:  isActive ? 'translateX(3px)' : 'translateX(0)',
                  opacity:    isDimmed ? 0.4 : 1,
                  transition: `transform 180ms ${SPRING}, opacity 150ms ease-out`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {/* Dot: scale cuando el item está activo */}
                  <div
                    style={{
                      background: s.color,
                      transform:  isActive ? 'scale(1.35)' : 'scale(1)',
                      transition: `transform 200ms ${SPRING}`,
                    }}
                    className="w-2 h-2 rounded-full shrink-0"
                  />
                  <span
                    className="text-xs font-black w-5 shrink-0 tabular-nums text-right"
                    style={{ color: RANK_COLORS[i] }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    className="text-xs font-bold truncate flex-1"
                    style={{
                      color:      isActive ? '#e4e4e7' : '#a1a1aa',
                      transition: 'color 150ms ease-out',
                    }}
                  >
                    {translateGenre(s.label)}
                  </span>
                  <span className="text-xs font-black tabular-nums shrink-0" style={{ color: s.color }}>
                    {s.pct}%
                  </span>
                </div>

                {/* Barra proporcional */}
                <div className="h-[2px] bg-[#0D0F15] rounded-full overflow-hidden ml-9">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:           `${(s.count / maxCount) * 100}%`,
                      background:      s.color,
                      opacity:         isActive ? 0.85 : 0.6,
                      transform:       mounted ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      transition:      `transform 500ms ${SNAPPY} ${100 + i * 55}ms, opacity 150ms ease-out`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
