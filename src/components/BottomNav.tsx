import { Link, useLocation } from 'react-router-dom';
import { Home, Search, List, UserCircle, Trophy } from 'lucide-react';
import { useUserData } from '../contexts/UserDataContext';

interface BottomNavProps {
  onOpenLogin: () => void;
}

export const BottomNav = ({ onOpenLogin }: BottomNavProps) => {
  const { session, username } = useUserData();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[98] bg-[var(--kr-glass-1)] backdrop-blur-xl border-t border-[#FF3B3B]/20 flex safe-area-inset-bottom">
      <Link
        to="/"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${isActive('/') && pathname === '/' ? 'text-[#FF3B3B]' : 'text-zinc-500'}`}
      >
        <Home size={20} />
        <span className="text-[9px] font-bold uppercase tracking-widest">Inicio</span>
      </Link>

      <Link
        to="/search"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${isActive('/search') ? 'text-[#FF3B3B]' : 'text-zinc-500'}`}
      >
        <Search size={20} />
        <span className="text-[9px] font-bold uppercase tracking-widest">Buscar</span>
      </Link>

      {session ? (
        <Link
          to="/watchlist"
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${isActive('/watchlist') ? 'text-[#FF3B3B]' : 'text-zinc-500'}`}
        >
          <List size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Mi Lista</span>
        </Link>
      ) : (
        <Link
          to="/top/rated"
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${isActive('/top') ? 'text-[#FF3B3B]' : 'text-zinc-500'}`}
        >
          <Trophy size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Ranking</span>
        </Link>
      )}

      {session ? (
        <Link
          to={username ? `/u/${username}` : '/profile'}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${(isActive('/profile') || isActive('/u/')) ? 'text-[#FF3B3B]' : 'text-zinc-500'}`}
        >
          <UserCircle size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Perfil</span>
        </Link>
      ) : (
        <button
          onClick={onOpenLogin}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-zinc-500 transition-colors"
        >
          <UserCircle size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Entrar</span>
        </button>
      )}
    </nav>
  );
};
