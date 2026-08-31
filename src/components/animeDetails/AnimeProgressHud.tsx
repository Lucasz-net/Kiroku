import type { AnimeFull } from '../../types/anime';

interface AnimeProgressHudProps {
  anime: AnimeFull;
  progress: number;
  isSaving: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}

const MAX_GRID_EPS = 120;

export const AnimeProgressHud = ({ anime, progress, isSaving, onDecrement, onIncrement }: AnimeProgressHudProps) => {
  const total = anime.episodes ?? 0;
  const pct = total > 0 ? Math.min((progress / total) * 100, 100) : 0;
  const showGrid = total > 0 && total <= MAX_GRID_EPS;

  return (
    <div className="flex flex-col gap-3 bg-[var(--kr-surface-2)] rounded-xl border border-[#FF3B3B]/20 px-4 py-3 w-full">

      {/* Barra de progreso numérica */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#FF3B3B]/80 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B3B] animate-pulse" />
          Progreso
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onDecrement}
            disabled={progress <= 0 || isSaving}
            className="w-6 h-6 flex items-center justify-center bg-[var(--kr-surface)] text-zinc-400 border border-[#FF3B3B]/15 hover:text-[#FF3B3B] disabled:opacity-50 transition-colors rounded-md"
          >-</button>
          <span className="text-[var(--kr-text)] font-mono text-sm font-bold w-16 text-center tabular-nums">
            {progress} <span className="text-zinc-600 text-xs">/ {total || '?'}</span>
          </span>
          <button
            onClick={onIncrement}
            disabled={isSaving}
            className="w-6 h-6 flex items-center justify-center bg-[var(--kr-surface)] text-zinc-400 border border-[#FF3B3B]/15 hover:text-[#FF3B3B] disabled:opacity-50 transition-colors rounded-md"
          >+</button>
        </div>
      </div>

      {/* Barra de progreso visual */}
      {total > 0 && (
        <div className="h-1 bg-[var(--kr-surface-sunken)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF3B3B] to-[#FF7777] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Grid de episodios — solo si hay un total razonable (#4) */}
      {showGrid && (
        <div
          className="flex flex-wrap gap-1 pt-1"
          title={`${progress} de ${total} episodios vistos`}
        >
          {Array.from({ length: total }).map((_, i) => {
            const watched = i < progress;
            const isCurrent = i === progress;
            return (
              <div
                key={i}
                title={`Episodio ${i + 1}`}
                className={`rounded-sm transition-all duration-200 ${
                  total <= 26 ? 'w-5 h-5 text-[8px]' : total <= 60 ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
                } ${
                  watched
                    ? 'bg-[#FF3B3B] border border-[#FF3B3B]/60'
                    : isCurrent
                      ? 'bg-[#FF3B3B]/30 border border-[#FF3B3B]/50 ring-1 ring-[#FF3B3B]/40'
                      : 'bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.08]'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
