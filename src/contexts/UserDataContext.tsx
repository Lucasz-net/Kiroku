import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { SavedAnime } from '../types/profile';

interface UserDataContextType {
  session: Session | null;
  username: string | null;
  avatarUrl: string | null;
  authReady: boolean;
  needsUsernameSetup: boolean;
  savedAnimes: SavedAnime[];
  getSavedStatus: (animeId: number) => string | null;
  isFavorited: (animeId: number) => boolean;
  getUserScore: (animeId: number) => number | null;
  refreshSavedAnimes: () => Promise<void>;
  refreshUsername: () => Promise<void>;
  applyUsername: (newUsername: string) => void;
  /**
   * El modal de login vive acá y no en App para que cualquier pantalla
   * pueda pedirlo. Sin esto, apretar "Agregar a mi lista" sin sesión no
   * hacía absolutamente nada: ni error, ni invitación a registrarse, justo
   * en el momento en que un visitante decide si se crea una cuenta.
   */
  isLoginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const UserDataContext = createContext<UserDataContextType>({
  session: null,
  username: null,
  avatarUrl: null,
  authReady: false,
  needsUsernameSetup: false,
  savedAnimes: [],
  getSavedStatus: () => null,
  isFavorited: () => false,
  getUserScore: () => null,
  refreshSavedAnimes: async () => {},
  refreshUsername: async () => {},
  applyUsername: () => {},
  isLoginOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components -- hook lives alongside its provider/context
export const useUserData = () => useContext(UserDataContext);

export const UserDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [savedAnimes, setSavedAnimes] = useState<SavedAnime[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const openLogin = useCallback(() => setIsLoginOpen(true), []);
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);

  const fetchSaved = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('saved_animes')
      .select('anime_id, status, is_favorite, user_score, id, title, image_url, episodes_total, score, year, genres, studios, duration, progress, created_at')
      .eq('user_id', userId);
    if (data) setSavedAnimes(data as SavedAnime[]);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, username_confirmed, avatar_url')
      .eq('id', userId)
      .single();
    setUsername(data?.username ?? null);
    setAvatarUrl(data?.avatar_url ?? null);
    setNeedsUsernameSetup(data ? !data.username_confirmed : false);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        fetchSaved(s.user.id);
        fetchProfile(s.user.id);
      } else {
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        fetchSaved(s.user.id);
        fetchProfile(s.user.id);
      } else {
        setSavedAnimes([]);
        setUsername(null);
        setAvatarUrl(null);
        setNeedsUsernameSetup(false);
        setAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSaved, fetchProfile]);

  const getSavedStatus = useCallback(
    (animeId: number) => savedAnimes.find(a => a.anime_id === animeId)?.status ?? null,
    [savedAnimes],
  );

  const isFavorited = useCallback(
    (animeId: number) => savedAnimes.find(a => a.anime_id === animeId)?.is_favorite ?? false,
    [savedAnimes],
  );

  const getUserScore = useCallback(
    (animeId: number) => savedAnimes.find(a => a.anime_id === animeId)?.user_score ?? null,
    [savedAnimes],
  );

  const refreshSavedAnimes = useCallback(async () => {
    if (session) await fetchSaved(session.user.id);
  }, [session, fetchSaved]);

  const refreshUsername = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  // Directly set username in context without a DB round-trip
  const applyUsername = useCallback((newUsername: string) => {
    setUsername(newUsername);
    setNeedsUsernameSetup(false);
  }, []);

  return (
    <UserDataContext.Provider value={{
      session, username, avatarUrl, authReady, needsUsernameSetup,
      savedAnimes, getSavedStatus, isFavorited, getUserScore,
      refreshSavedAnimes, refreshUsername, applyUsername,
      isLoginOpen, openLogin, closeLogin,
    }}>
      {children}
    </UserDataContext.Provider>
  );
};
