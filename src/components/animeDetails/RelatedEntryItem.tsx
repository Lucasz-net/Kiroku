import { Link } from 'react-router-dom';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import type { AnimeRelationEntry } from '../../types/anime';
import { translateEntryType } from '../../utils/translations';

interface RelatedEntryItemProps {
  entry: AnimeRelationEntry;
  // undefined = still loading | null = failed | string = loaded URL
  imageUrl?: string | null;
}

export const RelatedEntryItem = ({ entry, imageUrl }: RelatedEntryItemProps) => {
  const needsImage = entry.type === 'anime' || entry.type === 'manga';
  const isLoading = needsImage && imageUrl === undefined;
  const isClickable = entry.type === 'anime';

  const ContentBody = (
    <div className={`flex items-center gap-3 p-2 bg-[var(--kr-surface)] rounded-lg border border-[#FF3B3B]/15 transition-colors ${isClickable ? 'hover:border-[#FF3B3B]/40 hover:bg-[var(--kr-surface-2)] group' : 'opacity-70'}`}>
      <div className="w-10 h-14 shrink-0 bg-[var(--kr-surface-2)] flex items-center justify-center overflow-hidden rounded-md">
        {isLoading
          ? <Loader2 size={14} className="text-[#FF3B3B]/50 animate-spin" />
          : imageUrl
            ? <img src={imageUrl} alt={entry.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" loading="lazy" />
            : <ImageIcon size={16} className="text-zinc-600" />
        }
      </div>
      <div className="flex flex-col flex-1 min-w-0 pr-2">
        <span className={`text-[11px] font-bold line-clamp-2 leading-snug ${isClickable ? 'text-[var(--kr-text)] group-hover:text-[#FF3B3B] transition-colors' : 'text-zinc-400'}`}>
          {entry.name}
        </span>
        <span className="text-[9px] uppercase font-bold text-zinc-500 mt-1">Formato: {translateEntryType(entry.type)}</span>
      </div>
    </div>
  );

  return isClickable
    ? <Link to={`/anime/${entry.mal_id}`}>{ContentBody}</Link>
    : <div>{ContentBody}</div>;
};
