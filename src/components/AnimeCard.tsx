import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Anime } from '../types/anime';
import { Calendar, BookmarkCheck, Eye, Clock } from 'lucide-react';
import { getHighResImageUrl } from '../utils/animeUtils';
import { useUserData } from '../contexts/UserDataContext';
import { useJikanCover } from '../hooks/useJikanCover';
import { useInView } from '../hooks/useInView';
import { translateGenre } from '../utils/translations';

interface AnimeCardProps {
  anime: Anime;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  'Completado': { label: 'Completado', icon: BookmarkCheck, color: 'text-[#FF3B3B] bg-[#FF3B3B]/15 border-[#FF3B3B]/40' },
  'Mirando':    { label: 'Mirando',    icon: Eye,           color: 'text-[#FF7777] bg-[#FF7777]/15 border-[#FF7777]/40' },
  'Pendiente':  { label: 'Pendiente',  icon: Clock,         color: 'text-[#FF9B9B] bg-[#FF9B9B]/15 border-[#FF9B9B]/40' },
};

export const AnimeCard = ({ anime }: AnimeCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { getSavedStatus } = useUserData();
  const savedStatus = getSavedStatus(anime.mal_id);
  const statusCfg = savedStatus ? STATUS_CONFIG[savedStatus] : null;
  const baseImage = getHighResImageUrl(anime.images.jpg.large_image_url || anime.images.jpg.image_url);
  // La portada mejorada solo se pide para las tarjetas que llegan a verse:
  // es una petición a Jikan por tarjeta y todas comparten una cola de ~380 ms.
  const { ref: cardRef, inView } = useInView<HTMLAnchorElement>();
  const displayImage = useJikanCover(anime.mal_id, baseImage, inView);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const releaseDate = formatDate(anime.aired?.from);

  return (
    <Link
      ref={cardRef}
      to={`/anime/${anime.mal_id}`}
      className="flex flex-col bg-transparent group font-sans h-full cursor-pointer"
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-[#11131A] border border-[#FF3B3B]/10 group-hover:border-[#FF3B3B]/40 transition-all duration-500 shadow-sm group-hover:shadow-[0_0_24px_rgba(255,59,59,0.12)]">

        {/* Blur placeholder mientras carga */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1C24] to-[#0D0F15] animate-pulse" />
        )}

        <img
          src={displayImage}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = anime.images.jpg.large_image_url || anime.images.jpg.image_url;
          }}
          onLoad={() => setImgLoaded(true)}
          alt={anime.title}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Score badge */}
        {anime.score && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-[#0D0F15]/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-[#FF3B3B]/25">
            <span className="text-[#FF3B3B] text-[10px] leading-none">★</span>
            <span className="text-white font-black text-[11px] tabular-nums leading-none">{anime.score}</span>
          </div>
        )}

        {/* Estado guardado del usuario */}
        {statusCfg && (
          <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm ${statusCfg.color}`}>
            <statusCfg.icon size={9} />
            <span>{statusCfg.label}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F15]/95 via-[#0D0F15]/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400 flex flex-col justify-end p-3 gap-2">

          {/* Géneros */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">
              {anime.genres.slice(0, 3).map(g => (
                <span key={g.mal_id} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF3B3B]/20 text-[#FF9B9B] border border-[#FF3B3B]/30">
                  {translateGenre(g.name)}
                </span>
              ))}
            </div>
          )}

          {/* Botón Ver Detalles */}
          <span className="text-center text-white text-xs font-bold uppercase tracking-widest bg-[#0D0F15]/80 backdrop-blur-md border border-[#FF3B3B]/50 px-3 py-1.5 rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-100">
            Ver Detalles
          </span>
        </div>
      </div>

      <div className="pt-3 flex flex-col flex-1">
        <h3
          className="font-bold text-white text-sm line-clamp-2 leading-tight group-hover:text-[#FF3B3B] transition-colors"
          title={anime.title}
        >
          {anime.title}
        </h3>
        <div className="mt-1.5 flex flex-col gap-1">
          {releaseDate && (
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={10} className="text-[#FF3B3B]/70" /> {releaseDate}
            </p>
          )}
          <p className="text-xs text-zinc-600 font-bold">
            {anime.episodes ? `${anime.episodes} episodios` : 'En emisión'}
          </p>
        </div>
      </div>
    </Link>
  );
};
