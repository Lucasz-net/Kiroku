import { Link } from 'react-router-dom';
import type { Anime } from '../../types/anime';
import { getHighResImageUrl } from '../../utils/animeUtils';
import { translateGenre } from '../../utils/translations';

const getRankStyle = (index: number) => {
  switch (index) {
    case 0: return 'bg-gradient-to-b from-amber-400 to-yellow-600 text-amber-950';
    case 1: return 'bg-gradient-to-b from-slate-300 to-slate-500 text-slate-950';
    case 2: return 'bg-gradient-to-b from-amber-700 to-orange-800 text-[var(--kr-text)]';
    default: return 'bg-[var(--kr-surface-sunken)] text-zinc-500';
  }
};

// Estas filas siempre vienen del ranking de la API oficial de MAL, cuyo
// payload ya trae `main_picture` — una URL de cdn.myanimelist.net, o sea la
// misma portada con el logo del título que se buscaba pedirle a Jikan, y que
// getHighResImageUrl ya sube a la variante grande. Pedirla de nuevo
// devolvía exactamente el mismo string: eran 20 peticiones a Jikan en cada
// carga de Home (10 por ranking, y sin siquiera esperar a que la fila fuera
// visible) que no cambiaban un solo pixel.
export const RankingRow = ({ anime, index }: { anime: Anime; index: number }) => {
  const displayImage = getHighResImageUrl(anime.images.jpg.large_image_url || anime.images.jpg.image_url);

  return (
  <Link
    to={`/anime/${anime.mal_id}`}
    className="ranking-row group flex bg-[var(--kr-surface-sunken)] rounded-xl border border-[#FF3B3B]/[0.07] hover:border-[#FF3B3B]/30 hover:bg-[var(--kr-surface)] transition-all duration-300 overflow-hidden"
  >
    <div className={`w-14 flex items-center justify-center text-base font-black shrink-0 ${getRankStyle(index)}`}>
      {index + 1}
    </div>

    <div className="w-28 md:w-40 h-40 md:h-52 overflow-hidden shrink-0 relative">
      <img
        src={displayImage}
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = anime.images.jpg.image_url; }}
        alt={anime.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      />
    </div>

    <div className="p-4 md:p-5 flex flex-col justify-center flex-1 min-w-0">
      <h3 className="text-[var(--kr-text)] text-sm md:text-base font-bold truncate mb-2 group-hover:text-[#FF3B3B] transition-colors">
        {anime.title}
      </h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {anime.genres?.slice(0, 2).map(genre => (
          <span
            key={genre.mal_id}
            className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[var(--kr-surface)] text-zinc-600 border border-[#FF3B3B]/[0.07]"
          >
            {translateGenre(genre.name)}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-auto">
        <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest">
          {anime.episodes ? `${anime.episodes} Eps.` : 'En Emisión'}
        </span>
        <div className="flex items-center gap-1.5 bg-[var(--kr-surface)] px-2.5 py-1 rounded-lg border border-[#FF3B3B]/10 group-hover:border-[#FF3B3B]/30 transition-colors">
          <span className="text-[#FF3B3B] text-xs">★</span>
          <span className="text-[var(--kr-text)] font-black text-xs">{anime.score || 'N/A'}</span>
        </div>
      </div>
    </div>
  </Link>
  );
};
