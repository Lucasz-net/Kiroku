import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { SavedAnime } from '../types/profile';
import { setMonitoringUser } from '../lib/monitoring';
import type { MalAnimeEntry } from '../utils/malXmlParser';
import { getAnimeSummariesByMalIds, type AniListImportSummary } from '../services/aniListApi';
import { getAnimeById } from '../services/jikanApi';
import type { JikanFullResponse } from '../types/anime';

/**
 * Ritmo del completado de importaciones. AniList limita a 30 peticiones por
 * minuto (cabecera X-RateLimit-Limit), o sea 2 s por consulta; se deja un
 * margen para no rozar el límite. Como cada consulta trae hasta
 * ENRICH_BATCH_SIZE animes en vez de uno solo, esta pausa se paga por lote y
 * no por anime.
 */
const ENRICH_DELAY_MS = 2100;

/** Tope de `Page.media(idMal_in: ...)` en AniList — 50 animes por consulta. */
const ENRICH_BATCH_SIZE = 50;

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface ImportEnrichmentState {
  done: number;
  total: number;
}

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
   * Progreso del completado en segundo plano de una importación de MAL
   * (géneros, estudios, portadas). Vive acá y no en el modal de importación
   * para que siga corriendo — y el perfil pueda mostrar el porcentaje —
   * aunque el usuario cierre el modal o navegue a otra pantalla.
   */
  importEnrichment: ImportEnrichmentState | null;
  startImportEnrichment: (userId: string, entries: MalAnimeEntry[]) => void;
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
  importEnrichment: null,
  startImportEnrichment: () => {},
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
  const [importEnrichment, setImportEnrichment] = useState<ImportEnrichmentState | null>(null);
  const enrichRunningRef = useRef(false);

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

  // Completado en segundo plano de una importación de MAL: géneros, estudios,
  // portadas y duración. Se piden en lotes de hasta ENRICH_BATCH_SIZE contra
  // AniList (`idMal_in`), así que el límite real de 30 consultas/minuto se
  // paga por lote y no por anime — una lista de 500 son ~10 lotes en vez de
  // 500 consultas sueltas. `enrichRunningRef` evita pisar una corrida ya en
  // marcha si el usuario reabre el modal y vuelve a importar.
  const startImportEnrichment = useCallback((userId: string, entries: MalAnimeEntry[]) => {
    if (enrichRunningRef.current || entries.length === 0) return;
    enrichRunningRef.current = true;
    setImportEnrichment({ done: 0, total: entries.length });

    (async () => {
      const batches: MalAnimeEntry[][] = [];
      for (let i = 0; i < entries.length; i += ENRICH_BATCH_SIZE) {
        batches.push(entries.slice(i, i + ENRICH_BATCH_SIZE));
      }

      let done = 0;
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];

        let summaries: Map<number, AniListImportSummary>;
        try {
          summaries = await getAnimeSummariesByMalIds(batch.map(e => e.malId));
        } catch {
          summaries = new Map();
        }

        for (const entry of batch) {
          const summary = summaries.get(entry.malId);
          let patch: Record<string, unknown> | null = null;

          if (summary) {
            patch = {
              title: summary.title || entry.title,
              image_url: summary.imageUrl,
              episodes_total: summary.episodes || entry.totalEpisodes || null,
              score: summary.score,
              year: summary.year,
              genres: summary.genres,
              studios: summary.studios,
              duration: summary.duration,
            };
          } else {
            // AniList no tiene mapeado ese id de MAL: se cae a Jikan, cuyo
            // endpoint de detalle sí responde de forma fiable.
            try {
              const { data } = await getAnimeById(String(entry.malId)) as JikanFullResponse;
              patch = {
                title: data.title_english || data.title,
                image_url: data.images?.webp?.large_image_url || data.images?.jpg?.large_image_url || '',
                episodes_total: data.episodes || entry.totalEpisodes || null,
                score: data.score ?? null,
                year: data.year ?? (data.aired?.from ? new Date(data.aired.from).getFullYear() : null),
                genres: data.genres?.map(g => g.name) ?? [],
                studios: data.studios?.map(s => s.name) ?? [],
                duration: data.duration || null,
              };
            } catch { /* se completará en otra pasada */ }
          }

          if (patch) {
            await supabase.from('saved_animes').update(patch)
              .eq('user_id', userId).eq('anime_id', entry.malId);
            done++;
          }
        }

        // Se refresca por lote (no solo al final) para que las portadas y los
        // gráficos vayan apareciendo mientras el usuario sigue navegando.
        setImportEnrichment({ done, total: entries.length });
        await fetchSaved(userId);
        if (b < batches.length - 1) await delay(ENRICH_DELAY_MS);
      }

      enrichRunningRef.current = false;
      setImportEnrichment(null);
    })();
  }, [fetchSaved]);

  // Los errores quedan asociados al id del usuario (solo el id) para poder
  // responderle si escribe. Ver src/lib/monitoring.ts.
  useEffect(() => { setMonitoringUser(session?.user?.id ?? null); }, [session]);

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
      importEnrichment, startImportEnrichment,
      isLoginOpen, openLogin, closeLogin,
    }}>
      {children}
    </UserDataContext.Provider>
  );
};
