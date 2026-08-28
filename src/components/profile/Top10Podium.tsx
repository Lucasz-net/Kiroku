import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import type { Top10Entry } from '../../types/profile';

interface Top10PodiumProps {
  entries: Top10Entry[];
  size?: 'compact' | 'large';
}

type PodiumCfg = Record<number, {
  order: string; colWidth: string; imgSize: string; barHeight: string;
  barFrom: string; barTo: string; borderColor: string;
  numberColor: string; glow: string; numberSize: string;
}>;

// "compact": la sección resumen del perfil (top 3 con nombre, 4-5 solo como
// relleno visual del podio, sin texto — así no compite con el resto de
// tarjetas del perfil). "large": la página dedicada /top10/:username, con
// más espacio disponible — portadas más grandes y nombre en los 5 puestos.
const COMPACT_CFG: PodiumCfg = {
  4: {
    order: 'order-1', colWidth: 'w-14 sm:w-16 md:w-20', imgSize: 'w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28',
    barHeight: 'h-8 sm:h-9 md:h-11', barFrom: 'from-[#160F0F]', barTo: 'to-[#1D1414]',
    borderColor: 'border-zinc-700/40', numberColor: 'text-zinc-500', glow: '', numberSize: 'text-base md:text-lg',
  },
  2: {
    order: 'order-2', colWidth: 'w-20 sm:w-24 md:w-28', imgSize: 'w-20 h-32 sm:w-24 sm:h-36 md:w-28 md:h-40',
    barHeight: 'h-7 sm:h-8 md:h-9', barFrom: 'from-[#2A1414]', barTo: 'to-[#3A1F1F]',
    borderColor: 'border-zinc-400/40', numberColor: 'text-zinc-300', glow: '', numberSize: 'text-lg md:text-xl',
  },
  1: {
    order: 'order-3', colWidth: 'w-24 sm:w-28 md:w-32', imgSize: 'w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44',
    barHeight: 'h-9 sm:h-10 md:h-12', barFrom: 'from-[#4A0A0A]', barTo: 'to-[#FF3B3B]/40',
    borderColor: 'border-[#FF3B3B]/70', numberColor: 'text-white', glow: 'shadow-[0_0_30px_rgba(255,59,59,0.35)]', numberSize: 'text-lg md:text-xl',
  },
  3: {
    order: 'order-4', colWidth: 'w-20 sm:w-24 md:w-28', imgSize: 'w-20 h-32 sm:w-24 sm:h-36 md:w-28 md:h-40',
    barHeight: 'h-5 sm:h-5 md:h-6', barFrom: 'from-[#1E1111]', barTo: 'to-[#2A1414]',
    borderColor: 'border-[#FF3B3B]/25', numberColor: 'text-[#FF6B6B]/70', glow: '', numberSize: 'text-lg md:text-xl',
  },
  5: {
    order: 'order-5', colWidth: 'w-14 sm:w-16 md:w-20', imgSize: 'w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28',
    barHeight: 'h-8 sm:h-9 md:h-11', barFrom: 'from-[#160F0F]', barTo: 'to-[#1D1414]',
    borderColor: 'border-zinc-700/40', numberColor: 'text-zinc-500', glow: '', numberSize: 'text-base md:text-lg',
  },
};

const LARGE_CFG: PodiumCfg = {
  4: {
    order: 'order-1', colWidth: 'w-24 sm:w-28 md:w-32', imgSize: 'w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44',
    barHeight: 'h-10 sm:h-12 md:h-14', barFrom: 'from-[#160F0F]', barTo: 'to-[#1D1414]',
    borderColor: 'border-zinc-700/40', numberColor: 'text-zinc-500', glow: '', numberSize: 'text-xl md:text-2xl',
  },
  2: {
    order: 'order-2', colWidth: 'w-28 sm:w-32 md:w-40', imgSize: 'w-28 h-40 sm:w-32 sm:h-48 md:w-40 md:h-56',
    barHeight: 'h-24 sm:h-28 md:h-32', barFrom: 'from-[#2A1414]', barTo: 'to-[#3A1F1F]',
    borderColor: 'border-zinc-400/40', numberColor: 'text-zinc-300', glow: '', numberSize: 'text-3xl md:text-4xl',
  },
  1: {
    order: 'order-3', colWidth: 'w-32 sm:w-40 md:w-48', imgSize: 'w-32 h-48 sm:w-40 sm:h-56 md:w-48 md:h-64',
    barHeight: 'h-32 sm:h-36 md:h-40', barFrom: 'from-[#4A0A0A]', barTo: 'to-[#FF3B3B]/40',
    borderColor: 'border-[#FF3B3B]/70', numberColor: 'text-white', glow: 'shadow-[0_0_30px_rgba(255,59,59,0.35)]', numberSize: 'text-3xl md:text-4xl',
  },
  3: {
    order: 'order-4', colWidth: 'w-28 sm:w-32 md:w-40', imgSize: 'w-28 h-40 sm:w-32 sm:h-48 md:w-40 md:h-56',
    barHeight: 'h-16 sm:h-20 md:h-24', barFrom: 'from-[#1E1111]', barTo: 'to-[#2A1414]',
    borderColor: 'border-[#FF3B3B]/25', numberColor: 'text-[#FF6B6B]/70', glow: '', numberSize: 'text-3xl md:text-4xl',
  },
  5: {
    order: 'order-5', colWidth: 'w-24 sm:w-28 md:w-32', imgSize: 'w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44',
    barHeight: 'h-10 sm:h-12 md:h-14', barFrom: 'from-[#160F0F]', barTo: 'to-[#1D1414]',
    borderColor: 'border-zinc-700/40', numberColor: 'text-zinc-500', glow: '', numberSize: 'text-xl md:text-2xl',
  },
};

export const Top10Podium = ({ entries, size = 'compact' }: Top10PodiumProps) => {
  const byRank = (rank: number) => entries.find(e => e.rank === rank);
  const cfgMap = size === 'large' ? LARGE_CFG : COMPACT_CFG;

  return (
    <div className={`flex items-end justify-center ${size === 'large' ? 'gap-3 sm:gap-4 md:gap-6' : 'gap-2 sm:gap-3 md:gap-4'}`}>
      {[1, 2, 3, 4, 5].map(rank => {
        const entry = byRank(rank);
        const cfg = cfgMap[rank];
        if (!entry) return null;

        const showTitle = rank <= 3 || size === 'large';

        return (
          <div key={rank} className={`flex flex-col items-center shrink-0 ${cfg.colWidth} ${cfg.order}`}>
            {rank === 1 && (
              <Crown size={size === 'large' ? 28 : 16} className={`text-[#FFD166] drop-shadow-[0_0_8px_rgba(255,209,102,0.5)] ${size === 'large' ? 'mb-1.5' : 'mb-0.5'}`} />
            )}
            <Link
              to={`/anime/${entry.anime_id}`}
              className={`relative ${cfg.imgSize} rounded-xl overflow-hidden border-2 ${cfg.borderColor} ${cfg.glow} ${size === 'large' ? 'mb-2.5' : 'mb-1'} group shrink-0`}
            >
              <img
                src={entry.image_url}
                alt={entry.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </Link>
            {showTitle && (
              <p className={`${size === 'large' ? 'text-xs md:text-sm mb-2 h-8' : 'text-[11px] md:text-xs mb-1 h-7'} font-bold text-white text-center line-clamp-2 leading-tight px-1`}>
                {entry.title}
              </p>
            )}
            <div
              className={`w-full bg-gradient-to-t ${cfg.barFrom} ${cfg.barTo} ${cfg.barHeight} rounded-t-lg border-t-2 ${cfg.borderColor} flex items-start justify-center ${size === 'large' ? 'pt-1.5' : 'pt-0.5'}`}
            >
              <span className={`font-black tabular-nums ${cfg.numberColor} ${cfg.numberSize}`}>{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
