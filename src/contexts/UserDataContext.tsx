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

/**
 * Cuántos animes incompletos se rellenan por sesión (ver
 * `backfillSavedMetadata`). Es un trabajo de fondo que nadie está esperando,
 * así que no tiene sentido que una lista enorme se pase minutos consultando
 * AniList en cada arranque: se cubre una tanda acotada por sesión y el resto
 * queda para la próxima, hasta que converge. Lo que el usuario esté mirando
 * en pantalla igual se resuelve al instante por su cuenta (SavedAnimeCover).
 */
const BACKFILL_LIMIT = 300;

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
  /**
   * Actualiza una fila ya cargada sin volver a consultar la base.
   *
   * `refreshSavedAnimes` relee la lista entera —que en una cuenta con
   * historial importado son más de mil filas— y hasta ahora eso pasaba
   * también al puntuar con las estrellas: un clic, mil filas de vuelta. Para
   * los cambios donde ya se sabe exactamente qué cambió y en qué fila,
   * conviene esto. Alta o baja de un anime sí siguen releyendo, porque ahí
   * hace falta el id que genera la base.
   */
  patchSavedAnime: (animeId: number, patch: Partial<SavedAnime>) => void;
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
  patchSavedAnime: () => {},
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
  const backfillDoneRef = useRef(false);

  const openLogin = useCallback(() => setIsLoginOpen(true), []);
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);

  const fetchSaved = useCallback(async (userId: string): Promise<SavedAnime[]> => {
    const { data } = await supabase
      .from('saved_animes')
      .select('anime_id, status, is_favorite, user_score, id, title, image_url, episodes_total, score, year, genres, studios, duration, progress, created_at')
      .eq('user_id', userId);
    if (!data) return [];
    setSavedAnimes(data as SavedAnime[]);
    return data as SavedAnime[];
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

  /**
   * Relleno de las filas que quedaron incompletas en `saved_animes`.
   *
   * La tabla ES el caché de la lista del usuario: es permanente, va por
   * cuenta y no por navegador, y no tiene el techo de ~5 MB de localStorage.
   * El problema era que solo se llenaba de a pedazos — la importación de XML
   * inserta las filas sin portada a propósito (para que la lista aparezca en
   * segundos) y `SavedAnimeCover` resuelve únicamente las tarjetas que llegan
   * a verse. Todo lo que el usuario nunca scrolleó se volvía a pedir afuera
   * en cada visita, para siempre.
   *
   * Acá se completan en lotes de 50 por consulta a AniList (`idMal_in`), en
   * segundo plano y una sola vez por sesión, escribiendo el resultado en la
   * fila. A partir de la segunda visita al perfil no hay ninguna petición
   * externa: la portada, los géneros y los estudios ya están en la base.
   *
   * Solo se tocan campos vacíos. Nada de pisar el título ni ningún dato que
   * haya puesto la persona.
   */
  const backfillSavedMetadata = useCallback(async (userId: string, rows: SavedAnime[]) => {
    // El enriquecimiento de una importación recién hecha cubre exactamente
    // las mismas filas: si está corriendo, este pase sobra.
    if (backfillDoneRef.current || enrichRunningRef.current) return;

    const incomplete = rows
      .filter(row => !row.image_url || !row.genres || row.genres.length === 0)
      .slice(0, BACKFILL_LIMIT);
    if (incomplete.length === 0) {
      backfillDoneRef.current = true;
      return;
    }

    backfillDoneRef.current = true;
    let patched = 0;

    for (let i = 0; i < incomplete.length; i += ENRICH_BATCH_SIZE) {
      const batch = incomplete.slice(i, i + ENRICH_BATCH_SIZE);

      let summaries: Map<number, AniListImportSummary>;
      try {
        summaries = await getAnimeSummariesByMalIds(batch.map(r => r.anime_id));
      } catch {
        // AniList caído o rate-limited: se corta y se reintenta en la próxima
        // sesión. Insistir acá sería competir con las peticiones que el
        // usuario sí está esperando.
        break;
      }

      for (const row of batch) {
        const summary = summaries.get(row.anime_id);
        if (!summary) continue;

        const patch: Record<string, unknown> = {};
        if (!row.image_url && summary.imageUrl) patch.image_url = summary.imageUrl;
        if ((!row.genres || row.genres.length === 0) && summary.genres.length > 0) patch.genres = summary.genres;
        if ((!row.studios || row.studios.length === 0) && summary.studios.length > 0) patch.studios = summary.studios;
        if (row.year == null && summary.year != null) patch.year = summary.year;
        if (row.duration == null && summary.duration) patch.duration = summary.duration;
        if (row.episodes_total == null && summary.episodes != null) patch.episodes_total = summary.episodes;
        if (row.score == null && summary.score != null) patch.score = summary.score;
        if (Object.keys(patch).length === 0) continue;

        await supabase.from('saved_animes').update(patch).eq('id', row.id);
        patched++;
      }

      if (i + ENRICH_BATCH_SIZE < incomplete.length) await delay(ENRICH_DELAY_MS);
    }

    if (patched > 0) await fetchSaved(userId);
  }, [fetchSaved]);

  // Los errores quedan asociados al id del usuario (solo el id) para poder
  // responderle si escribe. Ver src/lib/monitoring.ts.
  useEffect(() => { setMonitoringUser(session?.user?.id ?? null); }, [session]);

  useEffect(() => {
    // El relleno arranca detrás de la lista ya renderizada, nunca antes:
    // `fetchSaved` pinta lo que hay en la base y recién después se completa
    // lo que falte. `backfillDoneRef` lo deja en una sola corrida por sesión,
    // así que los refrescos posteriores (guardar un anime, puntuar) no lo
    // vuelven a disparar.
    const loadUserData = (userId: string) => {
      fetchSaved(userId).then(rows => backfillSavedMetadata(userId, rows));
      fetchProfile(userId);
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUserData(s.user.id);
      else setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        loadUserData(s.user.id);
      } else {
        setSavedAnimes([]);
        setUsername(null);
        setAvatarUrl(null);
        setNeedsUsernameSetup(false);
        setAuthReady(true);
        // Otra cuenta en el mismo tab necesita su propio pase de relleno.
        backfillDoneRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSaved, fetchProfile, backfillSavedMetadata]);

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

  const patchSavedAnime = useCallback((animeId: number, patch: Partial<SavedAnime>) => {
    setSavedAnimes(prev => prev.map(a => (a.anime_id === animeId ? { ...a, ...patch } : a)));
  }, []);

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
      refreshSavedAnimes, patchSavedAnime, refreshUsername, applyUsername,
      importEnrichment, startImportEnrichment,
      isLoginOpen, openLogin, closeLogin,
    }}>
      {children}
    </UserDataContext.Provider>
  );
};
