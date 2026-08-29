import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Loader2 } from 'lucide-react';
import { getAiringSchedule, type AiringEntry } from '../services/aniListApi';
import type { SavedAnime } from '../types/profile';

interface UpcomingEpisodesProps {
  animes: SavedAnime[];
}

const DAY = 86400000;

/** "Hoy 21:30", "Mañana 11:16", "Jue 03:00" o la fecha si falta mucho. */
const formatAiring = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hour = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((timestamp - startOfToday.getTime()) / DAY);

  if (days <= 0) return `Hoy ${hour}`;
  if (days === 1) return `Mañana ${hour}`;
  if (days < 7) {
    const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${hour}`;
  }
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

/**
 * Próximos episodios de lo que el usuario está mirando.
 *
 * Solo se consultan los animes en estado "Mirando": los completados no
 * emiten nada y los pendientes todavía no le importan a nadie. AniList
 * responde por todos ellos en una sola consulta.
 *
 * Si ninguno está en emisión, la sección no se renderiza — vale más el
 * espacio que un cartel de "nada por ahora".
 */
export const UpcomingEpisodes = ({ animes }: UpcomingEpisodesProps) => {
  const [entries, setEntries] = useState<AiringEntry[] | null>(null);

  const watchingIds = animes
    .filter(a => a.status === 'Mirando')
    .map(a => a.anime_id);
  const key = watchingIds.join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    getAiringSchedule(key.split(',').map(Number))
      .then(result => { if (!cancelled) setEntries(result); })
      .catch(() => { if (!cancelled) setEntries([]); });

    return () => { cancelled = true; };
  }, [key]);

  // Sin nada en "Mirando" no hay nada que consultar ni que esperar.
  if (!key) return null;

  if (entries === null) {
    return (
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 mb-8">
        <Loader2 size={13} className="animate-spin text-[#FF3B3B]/60" />
        Buscando próximos episodios...
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <section className="mb-10">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
        <CalendarClock size={15} className="text-[#FF3B3B]/50" /> Próximos episodios
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {entries.map(entry => (
          <Link
            key={entry.mal_id}
            to={`/anime/${entry.mal_id}`}
            className="group shrink-0 w-56 flex items-center gap-3 bg-[#11131A] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/40 rounded-xl p-2.5 transition-colors"
          >
            <div className="w-11 h-16 shrink-0 rounded-lg overflow-hidden bg-[#0D0F15]">
              {entry.image_url && (
                <img
                  src={entry.image_url}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-[#FF3B3B] transition-colors">
                {entry.title}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1">
                Episodio {entry.episode}
              </p>
              <p className="text-[11px] font-bold text-[#FF3B3B] mt-0.5 tabular-nums">
                {formatAiring(entry.airingAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
