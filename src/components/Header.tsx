import { Search, UserCircle, Menu, X } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { searchAniList } from '../services/aniListApi';
import type { Anime } from '../types/anime';
import debounce from 'lodash.debounce';
import { useUserData } from '../contexts/UserDataContext';

interface HeaderProps {
  onOpenLogin: () => void;
}

const NAV_LINKS = [
  { to: '/',            label: 'Inicio',   isActive: (p: string) => p === '/' },
  { to: '/search',      label: 'Buscar',   isActive: (p: string) => p.startsWith('/search') },
  { to: '/top/rated',   label: 'Ranking',  isActive: (p: string) => p.startsWith('/top') },
  { to: '/watchlist',   label: 'Mi Lista', isActive: (p: string) => p.startsWith('/watchlist'), authRequired: true },
] as const;

export const Header = ({ onOpenLogin }: HeaderProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [instantResults, setInstantResults] = useState<Anime[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { session, username, avatarUrl } = useUserData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dropdownRef = useRef<HTMLFormElement>(null);

  // Close mobile menu on route change (adjust state during render, avoids an extra effect pass)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  }

  const debouncedFetchResults = useMemo(
    () => debounce(async (query: string) => {
      if (query.trim()) {
        try {
          const response = await searchAniList({ q: query, perPage: 3 });
          setInstantResults(response.data);
        } catch (error) { console.error(error); }
      } else { setInstantResults([]); }
    }, 300),
    []
  );

  useEffect(() => { return () => debouncedFetchResults.cancel(); }, [debouncedFetchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setInstantResults([]);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedFetchResults(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setInstantResults([]);
      navigate(`/search?q=${searchTerm}`);
    }
  };

  return (
    <>
      <header className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-[1200px] flex items-center gap-4 md:gap-6 px-4 md:px-6 py-3 md:py-4 bg-[#11131A]/90 backdrop-blur-xl border border-[#FF3B3B]/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] font-sans rounded-2xl">

        {/* ── Logo ── */}
        <div className="flex items-center gap-3 md:gap-5 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-2 md:gap-3 text-xl md:text-2xl font-black tracking-widest hover:opacity-80 transition-opacity"
            onClick={() => setInstantResults([])}
          >
            <img src="/logo.png" alt="Logo" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
            <span>KIROKU<span className="text-[#FF3B3B]">.</span></span>
          </Link>

          <div className="h-4 w-px bg-[#FF3B3B]/20 hidden md:block" />

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, isActive, ...rest }) => {
              const authRequired = 'authRequired' in rest ? rest.authRequired : false;
              if (authRequired && !session) return null;
              const active = isActive(pathname);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    active ? 'text-[#FF3B3B] bg-[#FF3B3B]/8' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ── Search (desktop) ── */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 relative hidden md:block"
          ref={dropdownRef}
        >
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Buscar animes, películas..."
              value={searchTerm}
              onChange={handleInputChange}
              className="w-full py-2.5 pl-5 pr-12 text-white bg-[#11131A]/80 border border-[#FF3B3B]/20 focus:border-[#FF3B3B] focus:outline-none focus:ring-1 focus:ring-[#FF3B3B]/50 transition-all placeholder:text-zinc-600 text-xs font-bold tracking-widest rounded-lg"
            />
            <button type="submit" className="absolute right-4 text-zinc-500 hover:text-[#FF3B3B] transition-colors">
              <Search size={16} />
            </button>
          </div>

          {instantResults.length > 0 && (
            <div className="absolute top-full left-0 w-full bg-[#11131A] border border-[#FF3B3B]/30 mt-4 shadow-[0_0_30px_rgba(255,59,59,0.1)] max-h-72 overflow-y-auto z-10 p-2 rounded-lg">
              {instantResults.map((anime) => (
                <Link
                  key={anime.mal_id}
                  to={`/anime/${anime.mal_id}`}
                  onClick={() => setInstantResults([])}
                  className="flex items-center gap-3 p-2 hover:bg-[#1A1C24] border border-transparent hover:border-[#FF3B3B]/20 transition-colors rounded-lg"
                >
                  <div className="w-10 h-14 bg-[#1A1C24] shrink-0 overflow-hidden rounded">
                    <img src={anime.images.jpg.image_url} alt={anime.title} className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate tracking-wide">{anime.title}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                      {anime.episodes ? `${anime.episodes} eps` : 'En emisión'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </form>

        {/* ── Right: Profile / Login + mobile toggle ── */}
        <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
          {session ? (
            <Link
              to={username ? `/u/${username}` : '/profile'}
              className="flex items-center gap-2 md:gap-3 bg-[#11131A]/80 px-3 md:px-4 py-2 border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 hover:shadow-[0_0_15px_rgba(255,59,59,0.15)] transition-all cursor-pointer group rounded-lg"
            >
              <div className="w-6 h-6 md:w-7 md:h-7 overflow-hidden flex items-center justify-center font-black text-white text-[10px] uppercase bg-[#FF3B3B] rounded-md shrink-0">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : (username?.charAt(0) || session.user.email?.charAt(0))
                }
              </div>
              <span className="hidden sm:inline text-[10px] font-bold tracking-widest uppercase text-zinc-400 group-hover:text-[#FF3B3B] transition-colors">
                {username || 'Perfil'}
              </span>
            </Link>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#11131A]/80 border border-[#FF3B3B]/20 text-zinc-400 hover:text-[#FF3B3B] hover:border-[#FF3B3B]/50 transition-colors rounded-lg"
            >
              <UserCircle size={18} />
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Entrar</span>
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(p => !p)}
            className="md:hidden flex items-center justify-center w-9 h-9 bg-[#0D0F15] border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 text-zinc-400 hover:text-[#FF3B3B] transition-all rounded-lg"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── Mobile dropdown menu ── */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[72px] left-1/2 -translate-x-1/2 w-[95%] max-w-[1200px] z-[99] bg-[#11131A]/95 backdrop-blur-xl border border-[#FF3B3B]/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search bar mobile */}
          <form
            onSubmit={(e) => { handleSearchSubmit(e); setIsMobileMenuOpen(false); }}
            className="p-4 border-b border-[#FF3B3B]/10"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Buscar animes, películas..."
                value={searchTerm}
                onChange={handleInputChange}
                className="w-full py-3 pl-5 pr-12 text-white bg-[#0D0F15] border border-[#FF3B3B]/20 focus:border-[#FF3B3B] focus:outline-none transition-all placeholder:text-zinc-600 text-sm font-bold rounded-lg"
              />
              <button type="submit" className="absolute right-4 text-zinc-500 hover:text-[#FF3B3B] transition-colors">
                <Search size={16} />
              </button>
            </div>
          </form>

          {/* Nav links mobile */}
          <nav className="p-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ to, label, isActive, ...rest }) => {
              const authRequired = 'authRequired' in rest ? rest.authRequired : false;
              if (authRequired && !session) return null;
              const active = isActive(pathname);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                    active
                      ? 'text-[#FF3B3B] bg-[#FF3B3B]/8 border border-[#FF3B3B]/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

    </>
  );
};
