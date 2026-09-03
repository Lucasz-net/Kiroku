import { Link } from 'react-router-dom';
import { Trophy, Pencil, Plus, Sparkles, ChevronRight } from 'lucide-react';
import type { Top10Entry } from '../../types/profile';
import { Top10Podium } from './Top10Podium';
import { DetailedMetrics } from './DetailedMetrics';

interface Top10SectionProps {
  entries: Top10Entry[];
  username: string;
  isOwner: boolean;
  onEditClick?: () => void;
  metrics: { minutes: number; days: string; watching: number; pending: number };
}

export const Top10Section = ({ entries, username, isOwner, onEditClick, metrics }: Top10SectionProps) => {
  const hasAny = entries.length > 0;
  const showTop10Column = hasAny || isOwner;
  const top5 = entries.filter(e => e.rank <= 5);

  return (
    <div className="profile-section relative bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl p-3 md:p-4 overflow-hidden">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 bg-[#FF3B3B]/10 blur-[80px] rounded-full pointer-events-none" />

      <div className={`relative z-10 grid grid-cols-1 ${showTop10Column ? 'lg:grid-cols-12 lg:gap-6' : ''} gap-4`}>
        <div className={showTop10Column ? 'lg:col-span-4' : ''}>
          <DetailedMetrics {...metrics} />
        </div>

        {showTop10Column && (
          <div className="lg:col-span-8 lg:pl-6 lg:border-l lg:border-[#FF3B3B]/10">
            <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Trophy size={14} className="text-[#FF3B3B]/50" /> Mi Top 10
              </p>
              {isOwner && (
                <button
                  onClick={onEditClick}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 text-zinc-400 hover:text-[#FF3B3B] font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors"
                >
                  {hasAny ? <><Pencil size={12} /> Editar</> : <><Plus size={12} /> Crear mi Top 10</>}
                </button>
              )}
            </div>

            {!hasAny ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <div className="w-14 h-14 rounded-2xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/20 flex items-center justify-center">
                  <Sparkles size={22} className="text-[#FF3B3B]/60" />
                </div>
                <p className="text-zinc-400 text-sm font-bold max-w-xs">
                  Todavía no armaste tu Top 10. Elegí entre tus animes completados y ordenalos como quieras.
                </p>
              </div>
            ) : (
              <div>
                <Top10Podium entries={top5} />
                <Link
                  to={`/top10/${username}`}
                  className="mt-2 flex items-center justify-center gap-1.5 text-[#FF3B3B] hover:text-[#FF6B6B] font-black text-xs uppercase tracking-widest transition-colors"
                >
                  Ver top 10 completo <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
