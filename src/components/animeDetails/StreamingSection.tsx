import { Play, ExternalLink } from 'lucide-react';

interface StreamingLink {
  name: string;
  url: string;
}

interface StreamingSectionProps {
  streaming: StreamingLink[];
}

export const StreamingSection = ({ streaming }: StreamingSectionProps) => {
  if (streaming.length === 0) return null;
  return (
    <section className="mb-16">
      <h3 className="text-2xl font-black text-[var(--kr-text)] mb-6 flex items-center gap-3">
        <Play size={24} className="text-[#FF3B3B]" /> Plataformas de Streaming
      </h3>
      <div className="flex flex-wrap gap-4">
        {streaming.map((link) => {
          const isNetflix = link.name.toLowerCase().includes('netflix');
          const isCrunchyroll = link.name.toLowerCase().includes('crunchyroll');
          return (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 bg-[var(--kr-surface)] border border-[#FF3B3B]/15 px-6 py-3 text-sm font-bold text-zinc-300 transition-all rounded-xl group ${
                isNetflix
                  ? 'hover:text-[var(--kr-text)] hover:border-red-600/60 hover:shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                  : isCrunchyroll
                    ? 'hover:text-[var(--kr-text)] hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                    : 'hover:text-[#FF3B3B] hover:border-[#FF3B3B]/40'
              }`}
            >
              {isNetflix && <img src="/logon.png" alt="Netflix" className="w-5 h-5 object-contain" />}
              {isCrunchyroll && <img src="/logoc.png" alt="Crunchyroll" className="w-5 h-5 object-contain" />}
              {link.name}
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
            </a>
          );
        })}
      </div>
      <p className="mt-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
        <span className="text-[#FF3B3B]">*</span> Tal vez no disponible en tu región
      </p>
    </section>
  );
};
