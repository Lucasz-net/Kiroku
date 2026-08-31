import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { scrollBehavior } from './utils/motion';

import { useUserData } from './contexts/UserDataContext';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/react';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import { LoginModal } from './components/LoginModal';
import { UsernameSetupModal } from './components/UsernameSetupModal';
import { Home } from './pages/Home';
import { UserDataProvider } from './contexts/UserDataContext';
import { ThemeProvider } from './contexts/ThemeContext';

const Search = lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const AnimeDetails = lazy(() => import('./pages/AnimeDetails').then(m => ({ default: m.AnimeDetails })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const RankingPage = lazy(() => import('./pages/RankingPage').then(m => ({ default: m.RankingPage })));
const SeasonalPage = lazy(() => import('./pages/SeasonalPage').then(m => ({ default: m.SeasonalPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })));
const Top10Page = lazy(() => import('./pages/Top10Page').then(m => ({ default: m.Top10Page })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const CharacterPage = lazy(() => import('./pages/CharacterPage').then(m => ({ default: m.CharacterPage })));
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
    if (pathname !== '/') window.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() });
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
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/personaje/:id" element={<CharacterPage />} />
          <Route path="/u/:username"  element={<PublicProfilePage />} />
          <Route path="/top10/:username" element={<Top10Page />} />
          <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
          <Route path="/privacidad"   element={<PrivacyPolicyPage />} />
          <Route path="/terminos"     element={<TermsPage />} />
          <Route path="*"             element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const AppContent = () => {
  // El estado del modal vive en el contexto para que también lo pueda abrir
  // una pantalla interna (ver AnimeDetails: guardar un anime sin sesión).
  const { needsUsernameSetup, authReady, isLoginOpen, openLogin, closeLogin } = useUserData();
  return (
    <div className="min-h-screen bg-[var(--kr-bg)] text-zinc-100 flex flex-col font-sans relative">
      <Header onOpenLogin={openLogin} />
      <main className="flex-1 w-full relative pb-16 md:pb-0">
        <AnimatedRoutes />
      </main>
      <Footer />
      <BottomNav onOpenLogin={openLogin} />
      <LoginModal isOpen={isLoginOpen} onClose={closeLogin} />
      {authReady && needsUsernameSetup && <UsernameSetupModal />}
      {/* Analítica de Vercel: se sirve desde el propio dominio, así que no
          agrega orígenes externos ni cookies de terceros. */}
      <Analytics />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--kr-surface)',
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
    <ThemeProvider>
      <Router>
        <UserDataProvider>
          <ScrollToTop />
          <AppContent />
        </UserDataProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
