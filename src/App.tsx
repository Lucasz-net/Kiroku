import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useUserData } from './contexts/UserDataContext';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import { LoginModal } from './components/LoginModal';
import { UsernameSetupModal } from './components/UsernameSetupModal';
import { Home } from './pages/Home';
import { UserDataProvider } from './contexts/UserDataContext';

const Search = lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const AnimeDetails = lazy(() => import('./pages/AnimeDetails').then(m => ({ default: m.AnimeDetails })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const RankingPage = lazy(() => import('./pages/RankingPage').then(m => ({ default: m.RankingPage })));
const SeasonalPage = lazy(() => import('./pages/SeasonalPage').then(m => ({ default: m.SeasonalPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));

const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <Loader2 className="animate-spin text-[#FF3B3B]" size={28} />
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== '/') window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
};

// Animación de entrada/salida por ruta (#16)
const AnimatedRoutes = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter');
  const prevPathname = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathname.current) {
      // Cambio real de página → transición completa (timing controlado por setTimeout)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransitionStage('exit');
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage('enter');
        prevPathname.current = location.pathname;
      }, 160);
      return () => clearTimeout(timer);
    } else {
      // Solo cambiaron search params → actualiza sin desmontar ni animar
      setDisplayLocation(location);
    }
  }, [location]);

  return (
    <div
      key={displayLocation.pathname}
      className={transitionStage === 'enter' ? 'page-enter' : 'page-exit'}
      style={{ minHeight: '100%' }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes location={displayLocation}>
          <Route path="/"             element={<Home />} />
          <Route path="/search"       element={<Search />} />
          <Route path="/anime/:id"    element={<AnimeDetails />} />
          <Route path="/profile"      element={<Profile />} />
          <Route path="/top/:filter"  element={<RankingPage />} />
          <Route path="/seasonal"     element={<SeasonalPage />} />
          <Route path="/watchlist"    element={<WatchlistPage />} />
          <Route path="/u/:username"  element={<PublicProfilePage />} />
          <Route path="/privacidad"   element={<PrivacyPolicyPage />} />
          <Route path="/terminos"     element={<TermsPage />} />
          <Route path="*"             element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const AppContent = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { needsUsernameSetup, authReady } = useUserData();
  return (
    <div className="min-h-screen bg-[#080A0F] text-zinc-100 flex flex-col font-sans relative">
      <Header onOpenLogin={() => setIsLoginOpen(true)} />
      <main className="flex-1 w-full relative pb-16 md:pb-0">
        <AnimatedRoutes />
      </main>
      <Footer />
      <BottomNav onOpenLogin={() => setIsLoginOpen(true)} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      {authReady && needsUsernameSetup && <UsernameSetupModal />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#11131A',
            border: '1px solid rgba(255,59,59,0.25)',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: '700',
          },
        }}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <UserDataProvider>
        <ScrollToTop />
        <AppContent />
      </UserDataProvider>
    </Router>
  );
}

export default App;
