import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { FavoriteCharacter } from '../../types/profile';

interface FavoriteCharactersSectionProps {
  characters: FavoriteCharacter[];
}

// Una fila de 4 tarjetas; "Ver más" agrega otra fila de 4 cada vez.
const ROW_SIZE = 4;

export const FavoriteCharactersSection = ({ characters }: FavoriteCharactersSectionProps) => {
  const [visibleCount, setVisibleCount] = useState(ROW_SIZE);

  const visible = characters.slice(0, visibleCount);
  const hasMore = visibleCount < characters.length;
  const isExpanded = visibleCount > ROW_SIZE;

  return (
    <div className="bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
        <Heart size={14} className="text-[#FF3B3B]/50" /> Personajes favoritos
        {characters.length > 0 && (
          <span className="text-zinc-600 font-black">{characters.length}</span>
        )}
      </p>

      {characters.length > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-2.5">
            {visible.map(char => (
              <Link
                key={char.character_id}
                to={`/personaje/${char.character_id}?anime=${char.anime_id}&titulo=${encodeURIComponent(char.anime_title)}`}
                title={`${char.name} — ${char.anime_title}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/15 group-hover:border-[#FF3B3B]/40 transition-colors">
                  <img
                    src={char.image_url}
                    alt={char.name}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--kr-surface)] via-transparent to-transparent opacity-80" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 leading-tight line-clamp-2 group-hover:text-zinc-200 transition-colors">
                  {char.name}
                </span>
              </Link>
            ))}
          </div>

          {(hasMore || isExpanded) && (
            <div className="mt-4 flex justify-center gap-4">
              {hasMore && (
                <button
                  onClick={() => setVisibleCount(n => n + ROW_SIZE)}
                  className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] transition-colors"
                >
                  Ver más
                </button>
              )}
              {isExpanded && (
                <button
                  onClick={() => setVisibleCount(ROW_SIZE)}
                  className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  Ver menos
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center py-8 gap-3">
          <Heart size={28} className="text-zinc-800" />
          <p className="text-xs text-zinc-600 text-center font-bold uppercase tracking-widest">
            Sin personajes favoritos
          </p>
        </div>
      )}
    </div>
  );
};
