import { useState } from 'react';
import { Heart, Users } from 'lucide-react';
import type { Character } from '../../types/anime';
import { translateRole } from '../../utils/translations';
import { useFavoriteCharacters } from '../../hooks/useFavoriteCharacters';
import { CharacterDetailModal } from './CharacterDetailModal';

interface CharactersGridProps {
  characters: Character[];
  animeId: number;
  animeTitle: string;
  currentUserId: string | null;
}

const INITIAL_VISIBLE = 24;

export const CharactersGrid = ({ characters, animeId, animeTitle, currentUserId }: CharactersGridProps) => {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const { isFavorited, savedImage, toggleFavorite, updateImage } = useFavoriteCharacters(currentUserId);
  const visible = showAll ? characters : characters.slice(0, INITIAL_VISIBLE);

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-black text-[var(--kr-text)] mb-6 flex items-center gap-3">
        <Users size={24} className="text-[#FF3B3B]" /> Personajes
        {characters.length > 0 && (
          <span className="text-sm font-bold text-zinc-500 border border-[#FF3B3B]/15 bg-[var(--kr-surface)] px-3 py-1 rounded-lg">
            {characters.length}
          </span>
        )}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {visible.length > 0 ? (
          visible.map((char) => (
            <CharacterCard
              key={char.character.mal_id}
              char={char}
              isFavorite={isFavorited(char.character.mal_id)}
              onClick={() => setSelected(char)}
            />
          ))
        ) : (
          <div className="col-span-full bg-[var(--kr-glass-4)] border border-[#FF3B3B]/15 rounded-xl p-8 flex justify-center text-center">
            <p className="text-zinc-500 font-bold italic">No se encontraron personajes.</p>
          </div>
        )}
      </div>

      {characters.length > INITIAL_VISIBLE && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setShowAll(v => !v)}
            className="px-6 py-2.5 border border-[#FF3B3B]/20 bg-[var(--kr-surface)] text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF3B3B] hover:text-[var(--kr-text)] hover:border-[#FF3B3B] transition-all rounded-xl"
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${characters.length})`}
          </button>
        </div>
      )}

      {selected && (
        <CharacterDetailModal
          character={selected}
          animeId={animeId}
          animeTitle={animeTitle}
          isFavorite={isFavorited(selected.character.mal_id)}
          canFavorite={!!currentUserId}
          savedImage={savedImage(selected.character.mal_id)}
          onToggleFavorite={imageUrl => toggleFavorite({
            character_id: selected.character.mal_id,
            name: selected.character.name,
            image_url: imageUrl,
            anime_id: animeId,
            anime_title: animeTitle,
          })}
          onUpdateImage={imageUrl => updateImage(selected.character.mal_id, imageUrl)}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
};

interface CharacterCardProps {
  char: Character;
  isFavorite: boolean;
  onClick: () => void;
}

const CharacterCard = ({ char, isFavorite, onClick }: CharacterCardProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      className="text-left bg-[var(--kr-surface)] relative group border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,59,59,0.1)] rounded-xl overflow-hidden"
    >
      <div className="aspect-[3/4] overflow-hidden relative bg-[var(--kr-surface-sunken)]">
        {!loaded && <div className="absolute inset-0 bg-[var(--kr-surface-2)] animate-pulse" />}
        <img
          src={char.character.images.jpg.image_url}
          alt={char.character.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${loaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kr-surface)] via-transparent to-transparent opacity-90" />
        {isFavorite && (
          <div className="absolute top-2 left-2 w-7 h-7 bg-[var(--kr-glass-2)] backdrop-blur-md flex items-center justify-center border border-[#FF3B3B]/15 rounded-lg">
            <Heart size={12} className="fill-[#FF3B3B] text-[#FF7777]" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-[var(--kr-surface)] to-transparent">
        <h4 className="text-[var(--kr-text)] text-xs font-bold truncate mb-1 drop-shadow-md">{char.character.name}</h4>
        <p className="text-[#FF7777] text-[10px] font-bold">{translateRole(char.role)}</p>
      </div>
    </button>
  );
};
