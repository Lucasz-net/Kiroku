import { Link } from 'react-router-dom';
import { Activity, BookmarkCheck, Eye, Clock, Heart } from 'lucide-react';
import type { SavedAnime } from '../../types/profile';

interface ActivityFeedProps {
  animes: SavedAnime[];
}

const STATUS_ICON = {
  'Completado': BookmarkCheck,
  'Mirando':    Eye,
  'Pendiente':  Clock,
} as const;

const STATUS_COLOR = {
  'Completado': 'text-[#FF3B3B]',
  'Mirando':    'text-[#FF7777]',
  'Pendiente':  'text-[#FF9B9B]',
} as const;

const formatRelative = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} año(s)`;
};

export const ActivityFeed = ({ animes }: ActivityFeedProps) => {
  const recent = [...animes]
    .filter(a => a.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 5);

  return (
    <div className="profile-section bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
        <Activity size={14} className="text-[#FF3B3B]/50" /> Actividad Reciente
      </p>

      {recent.length > 0 ? (
        <div className="flex flex-col gap-3">
          {recent.map(anime => {
            const Icon = STATUS_ICON[anime.status as keyof typeof STATUS_ICON] ?? Clock;
            const color = STATUS_COLOR[anime.status as keyof typeof STATUS_COLOR] ?? 'text-zinc-500';
            return (
              <Link
                key={anime.id}
                to={`/anime/${anime.anime_id}`}
                className="flex items-center gap-3 group hover:bg-[var(--kr-surface-sunken)] p-2 rounded-xl transition-colors border border-transparent hover:border-[#FF3B3B]/10"
              >
                <div className="w-8 h-11 shrink-0 overflow-hidden rounded-md bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/10">
                  <img
                    src={anime.image_url}
                    alt={anime.title}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--kr-text)] text-xs font-bold truncate group-hover:text-[#FF3B3B] transition-colors">
                    {anime.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon size={11} className={color} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{anime.status}</span>
                    {anime.is_favorite && <Heart size={9} className="fill-[#FF3B3B] text-[#FF3B3B]" />}
                  </div>
                </div>
                <span className="text-[11px] text-zinc-600 font-bold uppercase tracking-wider shrink-0">
                  {anime.created_at ? formatRelative(anime.created_at) : ''}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 gap-2 text-center">
          <Activity size={24} className="text-zinc-800" />
          <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">Sin actividad reciente</p>
        </div>
      )}
    </div>
  );
};
