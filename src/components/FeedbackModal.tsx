import { useState } from 'react';
import { MessageSquare, Copy, Check, X } from 'lucide-react';

interface FeedbackModalProps {
  email: string;
  onClose: () => void;
}

// Un mailto: directo no sirve de mucho en una notebook sin un cliente de
// correo instalado (el caso más común hoy) — el click no hace nada visible
// y parece que el botón está roto. Este modal muestra el correo como texto
// copiable, y deja el mailto: como opción extra para quien sí tenga Gmail
// (o similar) configurado como app de escritorio.
export const FeedbackModal = ({ email, onClose }: FeedbackModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-56 h-6 bg-[#FF3B3B] blur-2xl opacity-25 rounded-full pointer-events-none" />

        <div className="relative bg-[var(--kr-surface)] border border-[#FF3B3B]/25 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/60 to-transparent" />

          <button
            onClick={onClose}
            type="button"
            className="absolute top-5 right-5 text-zinc-600 hover:text-[var(--kr-text)] transition-colors bg-[var(--kr-surface-sunken)] hover:bg-[var(--kr-surface-2)] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 p-2 rounded-lg"
          >
            <X size={18} />
          </button>

          <div className="px-8 py-12 md:px-12 md:py-14 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center shadow-[0_0_25px_rgba(255,59,59,0.2)] mb-6">
              <MessageSquare size={34} className="text-[#FF3B3B]" />
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-[var(--kr-text)] tracking-tight mb-3">
              ¿Tenés feedback?
            </h2>

            <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-sm mb-8">
              Mandame un mensaje con ideas o cosas por arreglar — un bug que encontraste,
              algo que te gustaría que Kiroku tenga, o simplemente qué te pareció. Todo suma.
            </p>

            <button
              onClick={handleCopy}
              type="button"
              className="w-full flex items-center justify-between gap-3 bg-[var(--kr-surface-sunken)] hover:bg-[var(--kr-surface-2)] border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/30 transition-all rounded-xl px-5 py-4 mb-3"
            >
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('Feedback sobre Kiroku')}`}
                onClick={e => e.stopPropagation()}
                className="text-[var(--kr-text)] font-bold text-sm md:text-base hover:text-[#FF3B3B] transition-colors break-all text-left"
              >
                {email}
              </a>
              <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {copied
                  ? <><Check size={13} className="text-emerald-400" /> <span className="text-emerald-400">Copiado</span></>
                  : <><Copy size={13} /> Copiar</>}
              </span>
            </button>

            <p className="text-zinc-600 text-[11px] leading-relaxed max-w-sm">
              Copiá la dirección o hacé clic para abrirla en tu cliente de correo, si tenés uno configurado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
