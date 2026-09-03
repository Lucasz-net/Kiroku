import { type RefObject, useState } from 'react';
import { Trophy, Flame, Star } from 'lucide-react';
import type { AnimeFull } from '../../types/anime';
import { getHighResImageUrl } from '../../utils/animeUtils';
import { MetadataBox } from './MetadataBox';
import { AnimeSaveControls } from './AnimeSaveControls';
import { supabase } from '../../lib/supabase';
import { useUserData } from '../../contexts/UserDataContext';
import { translateGenre, translateFormat, translateStatus } from '../../utils/translations';

const getRankingBadgeStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black shadow-[0_0_30px_rgba(251,191,36,0.8)] border border-amber-300';
    case 2: return 'bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black shadow-[0_0_20px_rgba(203,213,225,0.7)] border border-white';
    case 3: return 'bg-gradient-to-r from-amber-700 to-orange-700 text-[var(--kr-text)] font-black shadow-[0_0_20px_rgba(180,83,9,0.7)] border border-amber-500';
    case 4: return 'bg-[#FF3B3B]/10 text-[#FF7777] border border-[#FF3B3B]/30 font-bold shadow-[0_0_10px_rgba(255,59,59,0.15)]';
    case 5: return 'bg-[#FF3B3B]/5 text-[#FF9B9B] border border-[#FF3B3B]/20 font-bold';
    default: return 'bg-[var(--kr-surface)] border border-zinc-800 text-zinc-500';
  }
};

const getPopularityBadgeStyle = (popularity: number) => {
  switch (popularity) {
    case 1: return 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-[var(--kr-text)] font-black shadow-[0_0_30px_rgba(217,70,239,0.8)] border border-fuchsia-300';
    case 2: return 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-[var(--kr-text)] font-black shadow-[0_0_20px_rgba(168,85,247,0.7)] border border-purple-300';
    case 3: return 'bg-gradient-to-r from-violet-500 to-purple-600 text-[var(--kr-text)] font-black shadow-[0_0_20px_rgba(139,92,246,0.7)] border border-violet-400';
    case 4: return 'bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30 font-bold shadow-[0_0_10px_rgba(217,70,239,0.15)]';
    case 5: return 'bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold';
    default: return 'bg-[var(--kr-surface-2)] border border-zinc-700/50 text-zinc-300';
  }
};

const SYNOPSIS_LIMIT = 280;

const Synopsis = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > SYNOPSIS_LIMIT;
  const displayed = isLong && !expanded ? text.slice(0, SYNOPSIS_LIMIT).trimEnd() + '…' : text;

  return (
    <div>
      <p className="text-zinc-400 text-base leading-relaxed">{displayed}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-[#FF3B3B] text-sm font-bold hover:text-[#FF7777] transition-colors"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
};

// Widget de puntuación de usuario corregido (Método Hitboxes Invisibles)
//
// No se puede puntuar lo que está en "Pendiente": es un anime que todavía no
// se vio, así que la nota no significa nada y ensucia el promedio y las
// estadísticas del perfil. Sí se puede en "Mirando", y no es un detalle
// menor: un anime en emisión no admite el estado "Completado" (ver
// getAvailableStatuses en AnimeDetails), así que atar la puntuación a
// "Completado" dejaría toda la temporada actual sin poder puntuarse, además
// de las series largas que alguien mira durante años.
//
// La nota ya guardada NO se borra al pasar a "Pendiente", solo se deja de
// mostrar el widget: si la persona retoma el anime, la recupera intacta.
const UserScoreWidget = ({ animeId, savedStatus }: { animeId: number; savedStatus: string | null }) => {
  const { getUserScore, session, patchSavedAnime } = useUserData();
  const currentScore = getUserScore(animeId);
  const [hover, setHover] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  if (!savedStatus || savedStatus === 'Pendiente' || !session) return null;

  const handleRate = async (score: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('saved_animes')
        .update({ user_score: score })
        .eq('user_id', session.user.id)
        .eq('anime_id', animeId);
      if (error) throw error;
      // Se parchea la fila en memoria en vez de releer la lista completa:
      // ya sabemos qué cambió y en cuál. En una cuenta con historial
      // importado, cada estrella disparaba una consulta de más de mil filas.
      patchSavedAnime(animeId, { user_score: score });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const display = hover || currentScore || 0;

  const getStarFill = (val: number) => {
    if (display >= val) return 'full';
    if (display >= val - 0.5) return 'half';
    return 'empty';
  };

  return (
    <div className="flex flex-col gap-2 bg-[var(--kr-surface-2)] p-4 rounded-xl border border-[#FF3B3B]/15">
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Tu Puntuación</span>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: 10 }).map((_, i) => {
          const val = i + 1;
          const fill = getStarFill(val);
          return (
            <div key={val} className="relative w-4 h-4 shrink-0 flex items-center justify-center">
              
              {/* Parte Visual de la Estrella (Capa del Fondo) */}
              <div className="relative w-[14px] h-[14px] pointer-events-none">
                {fill === 'half' ? (
                  <>
                    <Star size={14} className="text-zinc-700 absolute inset-0" />
                    <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: '50%' }}>
                      <Star size={14} className="text-[#FF3B3B] fill-[#FF3B3B] absolute inset-0 min-w-[14px]" />
                    </div>
                  </>
                ) : (
                  <Star
                    size={14}
                    className={`absolute inset-0 ${fill === 'full' ? 'text-[#FF3B3B] fill-[#FF3B3B]' : 'text-zinc-700'}`}
                  />
                )}
              </div>

              {/* Botones Invisibles para capturar clicks precisos (Capa Superior) */}
              <div className="absolute inset-0 flex z-10">
                <button
                  type="button"
                  disabled={saving}
                  onMouseEnter={() => setHover(val - 0.5)}
                  onClick={() => handleRate(val - 0.5)}
                  className="w-1/2 h-full cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                  aria-label={`Puntuar ${val - 0.5}`}
                />
                <button
                  type="button"
                  disabled={saving}
                  onMouseEnter={() => setHover(val)}
                  onClick={() => handleRate(val)}
                  className="w-1/2 h-full cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                  aria-label={`Puntuar ${val}`}
                />
              </div>
              
            </div>
          );
        })}
        <span className="text-[#FF3B3B] font-black text-sm ml-2 tabular-nums w-7 text-left">
          {display > 0 ? display : ''}
        </span>
      </div>
    </div>
  );
};

interface AnimeHeroPanelProps {
  anime: AnimeFull;
  displayYear: string | number;
  savedStatus: string | null;
  isFavorite: boolean;
  isSaving: boolean;
  isDropdownOpen: boolean;
  pendingStatus: string | null;
  progress: number;
  availableStatuses: string[];
  dropdownRef: RefObject<HTMLDivElement | null>;
  onToggleDropdown: () => void;
  onToggleFavorite: () => void;
  onStatusSelect: (status: string) => void;
  onSaveWithProgress: (status: string, progress: number) => void;
  onRemove: () => void;
  onPendingStatus: (status: string | null) => void;
  onProgressChange: (value: number) => void;
  onProgressDecrement: () => void;
  onProgressIncrement: () => void;
}

export const AnimeHeroPanel = ({
  anime, displayYear, savedStatus, isFavorite, isSaving, isDropdownOpen,
  pendingStatus, progress, availableStatuses, dropdownRef,
  onToggleDropdown, onToggleFavorite, onStatusSelect, onSaveWithProgress,
  onRemove, onPendingStatus, onProgressChange, onProgressDecrement, onProgressIncrement,
}: AnimeHeroPanelProps) => (
  <div className="bg-[var(--kr-glass-1)] backdrop-blur-xl mb-12 relative flex flex-col md:flex-row border border-[#FF3B3B]/20 shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden">

    {/* Fondo borroneado */}
    <div className="absolute inset-0 z-0 pointer-events-none">
      <img
        src={getHighResImageUrl(anime.images.webp?.large_image_url || anime.images.jpg.large_image_url || anime.images.jpg.image_url)}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover scale-110"
        style={{ filter: 'blur(48px)', opacity: 0.13 }}
      />
      <div className="absolute inset-0 bg-[var(--kr-glass-3)]" />
    </div>

    {/* Poster */}
    <div className="w-full md:w-[360px] bg-[var(--kr-surface-sunken)] p-5 flex justify-center items-center shrink-0 z-10">
      <div className="w-full aspect-[2/3] rounded-xl overflow-hidden border border-[#FF3B3B]/15 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
        <img
          src={getHighResImageUrl(anime.images.webp?.large_image_url || anime.images.jpg.large_image_url || anime.images.jpg.image_url)}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = anime.images.jpg.large_image_url || anime.images.jpg.image_url;
          }}
          alt={anime.title}
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>
    </div>

    {/* Info */}
    <div className="p-8 md:p-10 flex-1 flex flex-col relative z-10">
      <div className="flex flex-col xl:flex-row justify-between items-start mb-8 gap-8">
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl font-black text-[var(--kr-text)] mb-4 leading-tight">
            {anime.title}
          </h1>
          <div className="flex flex-wrap gap-2 mb-6">
            {anime.genres.map(g => (
              <span
                key={g.name}
                className="bg-[var(--kr-surface-2)] text-zinc-300 border border-[#FF3B3B]/20 text-[10px] px-3 py-1.5 uppercase tracking-widest font-bold rounded-md"
              >
                {translateGenre(g.name)}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {anime.rank && (
              <div className={`px-5 py-2 text-[11px] uppercase tracking-widest flex items-center gap-2 rounded-lg ${getRankingBadgeStyle(anime.rank)}`}>
                <Trophy size={13} /> Rank #{anime.rank}
              </div>
            )}
            {anime.popularity && (
              <div className={`px-5 py-2 text-[11px] uppercase tracking-widest flex items-center gap-2 rounded-lg ${getPopularityBadgeStyle(anime.popularity)}`}>
                <Flame size={13} /> Popularidad #{anime.popularity}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start xl:items-end gap-4 min-w-max">
          {/* Score global */}
          <div className="bg-[var(--kr-surface-2)] p-4 rounded-xl border border-[#FF3B3B]/20 w-full xl:w-auto">
            <div className="text-5xl font-black text-[#FF3B3B] drop-shadow-[0_0_10px_rgba(255,59,59,0.3)]">
              {anime.score || 'N/A'}
            </div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-1 font-bold">Puntuación Global</div>
          </div>

          {/* Rating del usuario */}
          <UserScoreWidget animeId={anime.mal_id} savedStatus={savedStatus} />

          <AnimeSaveControls
            anime={anime}
            savedStatus={savedStatus}
            isFavorite={isFavorite}
            isSaving={isSaving}
            isDropdownOpen={isDropdownOpen}
            pendingStatus={pendingStatus}
            progress={progress}
            availableStatuses={availableStatuses}
            dropdownRef={dropdownRef}
            onToggleDropdown={onToggleDropdown}
            onToggleFavorite={onToggleFavorite}
            onStatusSelect={onStatusSelect}
            onSaveWithProgress={onSaveWithProgress}
            onRemove={onRemove}
            onPendingStatus={onPendingStatus}
            onProgressChange={onProgressChange}
            onProgressDecrement={onProgressDecrement}
            onProgressIncrement={onProgressIncrement}
          />

        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <MetadataBox label="Formato" value={anime.type ? translateFormat(anime.type) : 'Desconocido'} />
        <MetadataBox label="Estado" value={translateStatus(anime.status)} />
        <MetadataBox label="Episodios" value={anime.episodes || 'En emisión'} />
        <MetadataBox label="Año" value={displayYear} />
        <MetadataBox
          label="Estudio"
          value={anime.studios?.[0]?.name || 'Desconocido'}
          isLink
          link={`/search?studioId=${anime.studios?.[0]?.mal_id}&studioName=${encodeURIComponent(anime.studios?.[0]?.name || '')}`}
        />
      </div>

      <div className="mt-auto">
        <h3 className="text-xl font-black text-[var(--kr-text)] mb-4">Sinopsis</h3>
        <Synopsis text={anime.synopsis || 'Sinopsis no disponible en la base de datos.'} />
      </div>
    </div>
  </div>
);