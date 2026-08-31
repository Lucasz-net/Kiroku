import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    // pb-28 en mobile deja lugar al BottomNav fijo (que si no, tapa el
    // footer al llegar al final de la página); en md+ no hay BottomNav.
    <footer className="bg-[#0D0F15] border-t border-[#FF3B3B]/20 pt-10 pb-28 md:py-10 mt-auto relative z-10 font-sans">
      <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">

        <div className="flex flex-col items-center md:items-start gap-2">
          <p className="text-zinc-400 text-[20px] font-black uppercase tracking-[0.2em]">
            Kiroku <span className="text-[#FF3B3B] drop-shadow-[0_0_5px_rgba(255,59,59,0.5)]">//</span>
          </p>
          <p className="text-zinc-600 text-[10px] font-bold">
            Datos de AniList y MyAnimeList (Jikan) • © {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            <Link to="/privacidad" className="hover:text-[#FF3B3B] transition-colors">Privacidad</Link>
            <span className="text-zinc-800">·</span>
            <Link to="/terminos" className="hover:text-[#FF3B3B] transition-colors">Términos</Link>
          </div>
        </div>

        <a
          href="https://github.com/Lucasz-net"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 px-6 py-3 bg-[#11131A] border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 transition-all duration-300 shadow-sm hover:shadow-[0_0_15px_rgba(255,59,59,0.15)] rounded-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover:text-[#FF3B3B] transition-colors duration-500">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
            <path d="M9 18c-4.51 2-5-2-7-2"></path>
          </svg>

          <div className="flex flex-col items-start leading-none">
            <span className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mb-1">Desarrollado por</span>
            <span className="text-zinc-300 text-[12px] font-black group-hover:text-[#FF3B3B] transition-colors">Lucasz-net</span>
          </div>
        </a>

      </div>
    </footer>
  );
};
