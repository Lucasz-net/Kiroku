import { Network } from 'lucide-react';
import type { AnimeRelation } from '../../types/anime';
import { RelatedEntryItem } from './RelatedEntryItem';
import { translateRelation } from '../../utils/translations';

interface RelatedContentSectionProps {
  relations: AnimeRelation[];
  imageMap: Record<number, string | null>;
}

export const RelatedContentSection = ({ relations, imageMap }: RelatedContentSectionProps) => {
  if (relations.length === 0) return null;
  return (
    <section className="mb-16">
      <h3 className="text-2xl font-black text-[var(--kr-text)] mb-6 flex items-center gap-3">
        <Network size={24} className="text-[#FF3B3B]" /> Contenido Relacionado
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {relations.map((rel, index) => (
          <div
            key={index}
            className="bg-[var(--kr-glass-1)] p-5 rounded-xl border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/30 transition-colors"
          >
            <span className="text-[#FF3B3B] text-[10px] font-bold uppercase tracking-widest block border-b border-[#FF3B3B]/15 pb-2 mb-4">
              {translateRelation(rel.relation)}
            </span>
            <div className="flex flex-col gap-3">
              {rel.entry.map(entry => (
                <RelatedEntryItem
                  key={entry.mal_id}
                  entry={entry}
                  imageUrl={imageMap[entry.mal_id]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
