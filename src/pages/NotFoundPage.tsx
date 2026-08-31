import { Link } from 'react-router-dom';
import { Home, Search, Compass } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const NotFoundPage = () => {
  useDocumentTitle('Página no encontrada');
  return (
  <div className="min-h-screen bg-[var(--kr-bg)] flex flex-col items-center justify-center gap-8 px-4 font-sans text-center pt-24 md:pt-0">
    <div className="relative">
      <div className="absolute inset-0 blur-3xl bg-[#FF3B3B]/10 rounded-full" />
      <p className="relative text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-700 tracking-tighter">
        404
      </p>
    </div>

    <div>
      <h1 className="text-2xl md:text-3xl font-black text-[var(--kr-text)] mb-2">Esta página no existe</h1>
      <p className="text-zinc-500 text-sm max-w-sm">
        Puede que el enlace esté roto o que la página se haya movido. Volvé al inicio o probá buscando algo.
      </p>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/"
        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#FF3B3B] text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors shadow-[0_0_20px_rgba(255,59,59,0.25)]"
      >
        <Home size={14} /> Volver al inicio
      </Link>
      <Link
        to="/search"
        className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--kr-surface)] border border-[#FF3B3B]/20 text-zinc-400 font-black text-xs uppercase tracking-widest rounded-xl hover:border-[#FF3B3B]/40 hover:text-[var(--kr-text)] transition-colors"
      >
        <Search size={14} /> Buscar animes
      </Link>
      <Link
        to="/seasonal"
        className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--kr-surface)] border border-[#FF3B3B]/20 text-zinc-400 font-black text-xs uppercase tracking-widest rounded-xl hover:border-[#FF3B3B]/40 hover:text-[var(--kr-text)] transition-colors"
      >
        <Compass size={14} /> Ver temporada
      </Link>
    </div>
  </div>
  );
};
