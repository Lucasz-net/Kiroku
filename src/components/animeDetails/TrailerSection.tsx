import { Film } from 'lucide-react';
import type { AnimeFull } from '../../types/anime';

interface TrailerSectionProps {
  trailer: AnimeFull['trailer'];
  title: string;
}

const buildEmbedUrl = (trailer: AnimeFull['trailer']): string | null => {
  if (trailer?.youtube_id) {
    return `https://www.youtube.com/embed/${trailer.youtube_id}`;
  }
  if (trailer?.embed_url) {
    try {
      const url = new URL(trailer.embed_url);
      url.searchParams.delete('autoplay');
      return url.toString();
    } catch {
      return trailer.embed_url.replace(/autoplay=1/g, 'autoplay=0');
    }
  }
  return null;
};

export const TrailerSection = ({ trailer, title }: TrailerSectionProps) => {
  const embedUrl = buildEmbedUrl(trailer);

  return (
    <section className="mb-16">
      <h3 className="text-2xl font-black text-[var(--kr-text)] mb-6 flex items-center gap-3">
        <Film size={24} className="text-[#FF3B3B]" /> Trailer Oficial
      </h3>
      {embedUrl ? (
        <div className="aspect-video w-full bg-[var(--kr-surface-sunken)] relative shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/40 transition-colors rounded-2xl overflow-hidden">
          <iframe
            src={embedUrl}
            title="Trailer"
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="bg-[var(--kr-glass-1)] py-16 px-8 border border-[#FF3B3B]/15 rounded-2xl flex flex-col items-center justify-center text-center">
          <span className="text-zinc-400 font-bold text-lg mb-6">No se encontró trailer oficial.</span>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' trailer oficial')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--kr-surface-2)] text-[var(--kr-text)] font-bold text-sm px-6 py-3 hover:bg-[#FF3B3B]/10 border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 hover:text-[#FF3B3B] transition-all rounded-xl"
          >
            Buscar en YouTube
          </a>
        </div>
      )}
    </section>
  );
};
