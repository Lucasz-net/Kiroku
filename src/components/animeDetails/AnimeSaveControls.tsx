import { type RefObject } from 'react';
import { ChevronDown, Check, Trash2, Loader2, Heart } from 'lucide-react';
import type { AnimeFull } from '../../types/anime';
import { AnimeProgressHud } from './AnimeProgressHud';

interface AnimeSaveControlsProps {
  anime: AnimeFull;
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

export const AnimeSaveControls = ({
  anime, savedStatus, isFavorite, isSaving, isDropdownOpen,
  pendingStatus, progress, availableStatuses, dropdownRef,
  onToggleDropdown, onToggleFavorite, onStatusSelect, onSaveWithProgress,
  onRemove, onPendingStatus, onProgressChange, onProgressDecrement, onProgressIncrement,
}: AnimeSaveControlsProps) => (
  <div className="flex flex-col gap-3 w-full">
    <div className="flex gap-2 w-full">
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        className={`p-3.5 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
          isFavorite
            ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/50 text-[#FF3B3B] shadow-[0_0_15px_rgba(255,59,59,0.2)]'
            : 'bg-[var(--kr-surface-2)] border-[#FF3B3B]/15 text-zinc-500 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/5 hover:border-[#FF3B3B]/30'
        }`}
      >
        <Heart size={18} className={isFavorite ? 'fill-[#FF3B3B]' : ''} />
      </button>

      <div className="relative flex-1" ref={dropdownRef}>
        <button
          onClick={onToggleDropdown}
          disabled={isSaving}
          className={`flex items-center justify-between gap-3 font-bold text-xs px-6 py-3.5 transition-all w-full rounded-xl ${
            savedStatus
              ? 'bg-[var(--kr-surface-2)] text-[#FF3B3B] border border-[#FF3B3B]/40 hover:bg-[var(--kr-surface-2)]/80 shadow-[0_0_15px_rgba(255,59,59,0.1)]'
              : 'bg-[#FF3B3B] text-[var(--kr-text)] hover:bg-[#FF6B6B] shadow-[0_0_15px_rgba(255,59,59,0.4)]'
          }`}
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin mx-auto" />
          ) : (
            <>
              <span className="flex items-center gap-2">
                {savedStatus && <Check size={16} />}
                {savedStatus || '+ Agregar a mi lista'}
              </span>
              <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full mt-2 right-0 w-full xl:w-64 bg-[var(--kr-surface)] border border-[#FF3B3B]/30 shadow-[0_0_20px_rgba(255,59,59,0.15)] z-50 animate-in fade-in rounded-xl overflow-hidden">
            {pendingStatus === 'Mirando' ? (
              <div className="p-5 flex flex-col gap-4">
                <label className="text-[10px] text-[#FF3B3B] font-mono uppercase tracking-widest text-center">
                  Episodios Vistos
                </label>
                
                {/* Solución de Flechas Personalizadas y ocultamiento de default spinners */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onProgressChange(Math.max(0, progress - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-[var(--kr-surface-2)] text-zinc-400 border border-[#FF3B3B]/15 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 transition-colors rounded-lg font-black"
                  >
                    -
                  </button>
                  
                  <input
                    type="number"
                    min="0"
                    max={anime.episodes || 9999}
                    value={progress}
                    onChange={(e) => onProgressChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                    className="w-16 bg-[var(--kr-surface-2)] border border-[#FF3B3B]/20 text-[var(--kr-text)] p-1.5 text-center text-sm focus:border-[#FF3B3B] focus:outline-none font-mono rounded-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                    autoFocus
                  />
                  
                  <button
                    type="button"
                    onClick={() => onProgressChange((anime.episodes && progress >= anime.episodes) ? progress : progress + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-[var(--kr-surface-2)] text-zinc-400 border border-[#FF3B3B]/15 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 transition-colors rounded-lg font-black"
                  >
                    +
                  </button>
                  
                  <span className="text-zinc-500 font-mono text-sm ml-1">/ {anime.episodes || '?'}</span>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onPendingStatus(null)}
                    className="flex-1 py-2 text-zinc-400 bg-[var(--kr-surface-2)] border border-[#FF3B3B]/15 hover:text-[var(--kr-text)] text-[10px] font-bold uppercase transition-colors rounded-lg"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => onSaveWithProgress('Mirando', progress)}
                    className="flex-1 py-2 bg-[#FF3B3B] text-[var(--kr-text)] font-bold text-[10px] uppercase hover:bg-[#FF6B6B] transition-colors rounded-lg"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {availableStatuses.map(status => (
                  <button
                    key={status}
                    onClick={() => onStatusSelect(status)}
                    className={`w-full text-left px-5 py-4 text-[11px] font-bold transition-colors hover:bg-[var(--kr-surface-2)] flex items-center justify-between border-b border-[#FF3B3B]/10 last:border-0 ${
                      savedStatus === status ? 'text-[#FF3B3B] bg-[var(--kr-surface-2)]' : 'text-zinc-400'
                    }`}
                  >
                    {status}
                    {savedStatus === status && <Check size={14} />}
                  </button>
                ))}
                {savedStatus && (
                  <button
                    onClick={onRemove}
                    className="w-full text-left px-5 py-4 text-[11px] font-bold text-red-500 hover:bg-red-500/10 transition-colors border-t border-[#FF3B3B]/15 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Quitar de la lista
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>

    {savedStatus === 'Mirando' && (
      <AnimeProgressHud
        anime={anime}
        progress={progress}
        isSaving={isSaving}
        onDecrement={onProgressDecrement}
        onIncrement={onProgressIncrement}
      />
    )}
  </div>
);