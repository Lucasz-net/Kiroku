import { Mail, X } from 'lucide-react';

interface EmailConfirmationModalProps {
  email: string;
  onClose: () => void;
}

// Aviso grande y centrado, además del mensaje chico que ya queda dentro del
// LoginModal — la idea es que a nadie se le pase por alto que falta
// confirmar el correo antes de poder iniciar sesión.
export const EmailConfirmationModal = ({ email, onClose }: EmailConfirmationModalProps) => {
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
              <Mail size={34} className="text-[#FF3B3B]" />
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-[var(--kr-text)] tracking-tight mb-3">
              ¡Revisá tu correo!
            </h2>

            <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-sm mb-2">
              Te enviamos un enlace de confirmación a
            </p>
            <p className="text-[var(--kr-text)] font-bold text-sm md:text-base mb-5 break-all">
              {email}
            </p>
            <p className="text-zinc-500 text-xs md:text-sm leading-relaxed max-w-sm mb-8">
              Abrilo para activar tu cuenta. Si no lo ves en unos minutos, revisá la carpeta de spam o promociones.
            </p>

            <button
              onClick={onClose}
              type="button"
              className="w-full max-w-xs flex items-center justify-center gap-2 bg-[#FF3B3B] text-[var(--kr-text)] font-black py-3.5 rounded-xl hover:bg-[#e02d2d] transition-all shadow-[0_0_20px_rgba(255,59,59,0.25)] hover:shadow-[0_0_30px_rgba(255,59,59,0.4)] text-sm uppercase tracking-widest"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
