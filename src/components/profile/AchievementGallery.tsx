import { useState } from 'react';
import { Trophy, X, Info } from 'lucide-react';
import type { Achievement } from '../../types/profile';

interface AchievementGalleryProps {
  unlockedAchievements: Achievement[];
}

const FILL_OVERRIDE: Partial<Record<number, React.CSSProperties>> = {
  6: { background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)' },
  7: {
    background: 'linear-gradient(270deg, #fde68a, #f43f5e, #a855f7, #22d3ee, #fde68a)',
    backgroundSize: '300% 300%',
    animation: 'ach-gradient 3.5s ease infinite',
  },
};

const KEYFRAMES = `
  @keyframes ach-gradient { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

  @keyframes glow-t4 {
    0%,100% { filter: drop-shadow(0 0 10px var(--gc)) drop-shadow(0 0 18px var(--gc2)); }
    50%     { filter: drop-shadow(0 0 22px var(--gc)) drop-shadow(0 0 40px var(--gc2)); }
  }
  @keyframes glow-t5 {
    0%,100% { filter: drop-shadow(0 0 12px var(--gc)) drop-shadow(0 0 22px var(--gc2)); }
    50%     { filter: drop-shadow(0 0 28px var(--gc)) drop-shadow(0 0 52px var(--gc2)); }
  }
  @keyframes glow-t6 {
    0%,100% { filter: drop-shadow(0 0 14px var(--gc)) drop-shadow(0 0 28px var(--gc2)); }
    50%     { filter: drop-shadow(0 0 34px var(--gc)) drop-shadow(0 0 70px var(--gc2)); }
  }
  @keyframes glow-t7 {
    0%,100% { filter: drop-shadow(0 0 18px var(--gc)) drop-shadow(0 0 40px var(--gc2)) drop-shadow(0 0 65px var(--gc3)); }
    50%     { filter: drop-shadow(0 0 42px var(--gc)) drop-shadow(0 0 90px var(--gc2)) drop-shadow(0 0 140px var(--gc3)); }
  }
`;

// [animation-name, duration] per difficulty tier
const GLOW_ANIM: Partial<Record<number, [string, string]>> = {
  4: ['glow-t4', '3s'],
  5: ['glow-t5', '2.4s'],
  6: ['glow-t6', '1.8s'],
  7: ['glow-t7', '1.3s'],
};

const Medal = ({ ach, sizePx }: { ach: Achievement; sizePx: number }) => {
  const diff       = ach.difficulty;
  const shapeStyle = ach.shape ? { clipPath: ach.shape } : { borderRadius: '9999px' };
  const fillStyle  = FILL_OVERRIDE[diff];
  const iconSize   = Math.round(sizePx * 0.44);

  return (
    <div style={{ position: 'relative', width: sizePx, height: sizePx }}>
      <div className="absolute inset-0 overflow-hidden" style={{ ...shapeStyle }}>
        <div
          className={fillStyle ? 'absolute inset-0' : `absolute inset-0 bg-gradient-to-br ${ach.color}`}
          style={fillStyle}
        />
        <ach.icon
          size={iconSize}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--kr-text)]"
          style={{ zIndex: 2, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}
        />
      </div>
    </div>
  );
};

const extractAccentColor = (glowClass?: string): string => {
  const match = glowClass?.match(/rgba\([^)]+\)/);
  if (match) return match[0].replace(/[\d.]+\)$/, '0.85)');
  return 'rgba(255,59,59,0.5)';
};

// Tailwind arbitrary drop-shadow classes are purged when generated dynamically —
// convert to inline CSS filter string instead.
const glowToFilter = (glowClass?: string): string | undefined => {
  if (!glowClass) return undefined;
  const parts = glowClass.match(/drop-shadow-\[([^\]]+)\]/g);
  if (!parts) return undefined;
  return parts
    .map(p => `drop-shadow(${(p.match(/drop-shadow-\[([^\]]+)\]/)?.[1] ?? '').replace(/_/g, ' ')})`)
    .join(' ');
};

// Extracts up to 3 rgba colors from glowClass as CSS custom properties (--gc, --gc2, --gc3).
const glowVars = (glowClass?: string): React.CSSProperties => {
  if (!glowClass) return {};
  const colors = [...glowClass.matchAll(/rgba\([^)]+\)/g)].map(m => m[0]);
  return {
    '--gc':  colors[0] ?? 'transparent',
    '--gc2': colors[1] ?? colors[0] ?? 'transparent',
    '--gc3': colors[2] ?? colors[0] ?? 'transparent',
  } as React.CSSProperties;
};

const medalGlowStyle = (ach: Achievement): React.CSSProperties => {
  const diff = ach.difficulty;
  if (diff <= 1) return {};
  const anim = GLOW_ANIM[diff];
  if (anim) {
    return {
      ...glowVars(ach.glowClass),
      animation: `${anim[0]} ${anim[1]} ease-in-out infinite`,
    };
  }
  return { filter: glowToFilter(ach.glowClass) };
};

const GRID_LIMIT = 12; // 4 filas × 3 columnas

export const AchievementGallery = ({ unlockedAchievements }: AchievementGalleryProps) => {
  const [selected, setSelected] = useState<Achievement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasMore = unlockedAchievements.length > GRID_LIMIT;
  const visible = expanded ? unlockedAchievements : unlockedAchievements.slice(0, GRID_LIMIT);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl p-6">

        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
          <Trophy size={14} className="text-[#FF3B3B]/50" /> Vitrina de Logros
        </p>

        {unlockedAchievements.length > 0 ? (
          <>
          <div className="grid grid-cols-3 gap-3">
            {visible.map(ach => {
              const accentColor = extractAccentColor(ach.glowClass);
              return (
                <div
                  key={ach.id}
                  onClick={() => setSelected(ach)}
                  className="relative py-4 px-2 transition-all duration-200 flex flex-col items-center text-center group cursor-pointer rounded-xl bg-[var(--kr-surface-sunken)] hover:bg-[#13151C]"
                  style={{
                    borderLeft:   `3px solid ${accentColor}`,
                    borderTop:    '1px solid rgba(255,255,255,0.04)',
                    borderRight:  '1px solid rgba(255,255,255,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 hidden group-hover:block w-max max-w-[160px] bg-[var(--kr-surface)] border border-[#FF3B3B]/20 text-zinc-300 text-[10px] px-3 py-2 shadow-lg z-20 animate-in fade-in pointer-events-none rounded-lg">
                    {ach.desc}
                  </div>

                  <div
                    className="transition-transform duration-200 group-hover:scale-110 mb-3"
                    style={medalGlowStyle(ach)}
                  >
                    <Medal ach={ach} sizePx={44} />
                  </div>

                  <span className="text-[11px] font-bold text-zinc-400 leading-tight line-clamp-2 group-hover:text-zinc-200 transition-colors">
                    {ach.name}
                  </span>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-4 w-full py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 bg-[var(--kr-surface-sunken)] transition-all rounded-xl"
            >
              {expanded ? 'Ver menos' : `Ver más (${unlockedAchievements.length - GRID_LIMIT} más)`}
            </button>
          )}
          </>
        ) : (
          <div className="flex flex-col items-center py-8 gap-3">
            <Trophy size={28} className="text-zinc-800" />
            <p className="text-xs text-zinc-600 text-center font-bold uppercase tracking-widest">
              Sin logros desbloqueados
            </p>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--kr-glass-2)] backdrop-blur-md animate-in fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[var(--kr-surface)] border border-[#FF3B3B]/20 p-10 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-[#FF3B3B] transition-colors bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/15 p-2 z-10 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center mt-4">
              <div className="mb-8" style={medalGlowStyle(selected)}>
                <Medal ach={selected} sizePx={144} />
              </div>

              <h3 className="text-2xl font-black text-[var(--kr-text)] mb-5">{selected.name}</h3>

              <div className="bg-[var(--kr-surface-sunken)] p-5 border border-[#FF3B3B]/15 w-full relative text-left rounded-xl">
                <Info size={16} className="absolute top-5 left-4 text-[#FF3B3B]/60" />
                <p className="text-[#FF3B3B]/70 font-bold text-[10px] uppercase tracking-widest mb-2 ml-7">
                  Requisito desbloqueado
                </p>
                <p className="text-zinc-300 text-sm ml-7 leading-relaxed">{selected.desc}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
