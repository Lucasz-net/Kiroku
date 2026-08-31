import { useEffect, useState, useRef } from 'react';
import { scrollBehavior } from '../utils/motion';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import { getAnimeById, getAnimeStreaming, getMediaImage, JikanError } from '../services/jikanApi';
import { getAnimeRanking, getAnimeCharactersMal } from '../services/malApi';
import { getAnimeFullByMalId } from '../services/aniListApi';
import { translateToSpanish } from '../services/translateApi';
import { getHighResImageUrl, buildSavedAnimePayload } from '../utils/animeUtils';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { AnimeFull, Character } from '../types/anime';
import { supabase } from '../lib/supabase';
import { AnimeHeroPanel } from '../components/animeDetails/AnimeHeroPanel';
import { RelatedContentSection } from '../components/animeDetails/RelatedContentSection';
import { StreamingSection } from '../components/animeDetails/StreamingSection';
import { TrailerSection } from '../components/animeDetails/TrailerSection';
import { CharactersGrid } from '../components/animeDetails/CharactersGrid';
import { AnimeDetailsSkeleton } from '../components/animeDetails/AnimeDetailsSkeleton';
import { useUserData } from '../contexts/UserDataContext';

interface StreamingLink {
  name: string;
  url: string;
}

// Principales primero (ordenados por favoritos), después los secundarios
// más queridos — la lista cruda de MAL trae decenas de personajes de fondo
// que no aportan nada a la grilla.
const sortCharacters = (list: Character[]): Character[] => {
  const byFav = (a: Character, b: Character) => (b.favorites ?? 0) - (a.favorites ?? 0);
  const mains = list.filter(c => c.role === 'Main').sort(byFav);
  const supporting = list.filter(c => c.role === 'Supporting').sort(byFav).slice(0, 15);
  return [...mains, ...supporting];
};

export const AnimeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<AnimeFull | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [streaming, setStreaming] = useState<StreamingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [relatedImages, setRelatedImages] = useState<Record<number, string | null>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { session, savedAnimes, refreshSavedAnimes, openLogin } = useUserData();

  useDocumentTitle(anime?.title ?? '');

  const getAvailableStatuses = () => {
    if (!anime) return [];
    if (anime.status === 'Currently Airing') return ['Mirando', 'Pendiente'];
    if (anime.status === 'Not yet aired') return ['Pendiente'];
    return ['Completado', 'Mirando', 'Pendiente'];
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const malId = Number(id);

    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    setAnime(null);
    setCharacters([]);
    setStreaming([]);
    setRelatedImages({});
    window.scrollTo({ top: 0, behavior: scrollBehavior() });

    // Synopses come back in English from both sources. Show them immediately
    // and swap in a Spanish translation once it lands — never block on it,
    // and if the (unofficial, keyless) translate endpoint is unreachable the
    // English text just stays as-is.
    const translateSynopsisInBackground = (text?: string | null) => {
      if (!text) return;
      translateToSpanish(text)
        .then(translated => {
          if (cancelled || !translated) return;
          setAnime(prev => prev ? { ...prev, synopsis: translated } : prev);
        })
        .catch(() => { /* keep the original synopsis */ });
    };

    // Fallback chain — used when AniList has no mapping for this MAL id,
    // or when the AniList request itself fails.
    const loadFromJikan = () => {
      getAnimeById(id)
        .then(animeRes => {
          if (cancelled) return;
          setAnime(animeRes.data);
          setLoading(false);
          translateSynopsisInBackground(animeRes.data.synopsis);
        })
        .catch(error => {
          if (cancelled) return;
          console.error(error);
          if (error instanceof JikanError && error.status === 404) setNotFound(true);
          else setLoadError(true);
          setLoading(false);
        });

      // Non-critical: failures here must not block the main details from showing.
      getAnimeStreaming(id)
        .then(streamingRes => { if (!cancelled) setStreaming(streamingRes.data || []); })
        .catch(error => console.error(error));
    };

    // AniList is the primary source: one query instead of three, backed by
    // its own database rather than proxying MAL, so it isn't exposed to
    // Jikan's "failed to connect to MyAnimeList" outages.
    getAnimeFullByMalId(malId)
      .then(bundle => {
        if (cancelled) return;
        if (!bundle) { loadFromJikan(); return; }

        setAnime(bundle.anime);
        setStreaming(bundle.streaming);
        setLoading(false);
        translateSynopsisInBackground(bundle.anime.synopsis);

        // MAL/Jikan cover art usually has the title logo baked in; AniList's
        // doesn't. Try to upgrade the poster to Jikan's version in the
        // background — if Jikan is unavailable for this title, the AniList
        // cover we already rendered just stays as-is.
        getMediaImage('anime', malId)
          .then(res => {
            if (cancelled) return;
            const url = getHighResImageUrl(res.data?.images?.jpg?.large_image_url || res.data?.images?.jpg?.image_url);
            if (!url) return;
            setAnime(prev => prev ? { ...prev, images: { jpg: { image_url: url, large_image_url: url } } } : prev);
          })
          .catch(() => { /* keep the AniList cover */ });
      })
      .catch(error => {
        if (cancelled) return;
        console.error(error);
        loadFromJikan();
      });

    return () => { cancelled = true; };
  }, [id, retryToken]);

  // Los personajes se cargan por su cuenta, sin depender de qué fuente
  // respondió por el anime en sí. Salen de la API oficial de MAL: los
  // endpoints de personaje de Jikan respondían 504 de forma sostenida.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getAnimeCharactersMal(Number(id))
      .then(list => { if (!cancelled) setCharacters(sortCharacters(list)); })
      .catch(error => console.error(error));

    return () => { cancelled = true; };
  }, [id, retryToken]);

  // Saved status comes from the shared user-data context, which already keeps
  // the user's saved_animes list in sync — avoids a redundant query and any
  // race condition with auth initialization.
  useEffect(() => {
    if (!anime) {
      setSavedStatus(null);
      setIsFavorite(false);
      setProgress(0);
      return;
    }
    const saved = savedAnimes.find(a => a.anime_id === anime.mal_id);
    setSavedStatus(saved?.status ?? null);
    setIsFavorite(saved?.is_favorite ?? false);
    setProgress(saved?.progress ?? 0);
  }, [anime, savedAnimes]);

  // Rank/Popularity/Score badges must show MyAnimeList's own official
  // numbers (api/mal/*, backed by MAL's client-ID-authenticated API v2),
  // same as the Home page and full Ranking page — regardless of whether
  // this page's primary source was AniList or the Jikan fallback. Score
  // falls back to whatever the primary source already set if MAL has none
  // (e.g. an unreleased title) rather than blanking it out.
  useEffect(() => {
    if (!anime) return;
    const malId = anime.mal_id;
    let cancelled = false;
    getAnimeRanking(malId)
      .then(({ rank, popularity, score }) => {
        if (cancelled) return;
        setAnime(prev => (prev && prev.mal_id === malId) ? { ...prev, rank, popularity, score: score ?? prev.score } : prev);
      })
      .catch(() => { /* leave badges hidden/whatever was already there */ });
    return () => { cancelled = true; };
    // Deliberately keyed on mal_id, not `anime` — this effect's own setAnime
    // calls change `anime`, which would otherwise retrigger it in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime?.mal_id]);

  useEffect(() => {
    if (!anime?.relations) return;
    // El sitio solo maneja anime, así que las entradas de manga/novela ni
    // siquiera se muestran (ver filteredRelations) — no tiene sentido
    // pedirles imagen acá.
    const entries = anime.relations
      .filter(rel => rel.relation.toLowerCase() !== 'adaptation')
      .flatMap(rel => rel.entry)
      .filter((e): e is typeof e & { type: 'anime' } => e.type === 'anime');
    if (entries.length === 0) return;
    let cancelled = false;

    // Fired in parallel, but getMediaImage funnels every request through the
    // shared Jikan queue (throttled + cached), so this no longer needs its
    // own manual pacing/backoff.
    entries.forEach(entry => {
      getMediaImage(entry.type, entry.mal_id)
        .then(res => {
          if (cancelled) return;
          const url = getHighResImageUrl(res.data?.images?.jpg?.large_image_url || res.data?.images?.jpg?.image_url);
          setRelatedImages(prev => ({ ...prev, [entry.mal_id]: url || null }));
        })
        .catch(() => {
          if (!cancelled) setRelatedImages(prev => ({ ...prev, [entry.mal_id]: null }));
        });
    });

    return () => { cancelled = true; };
  }, [anime]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setPendingStatus(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveAnime = async (newStatus: string, episodesWatched = 0) => {
    if (!session || !anime) return;
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('saved_animes')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('anime_id', anime.mal_id)
        .maybeSingle();
      const payload = buildSavedAnimePayload(anime, session.user.id, newStatus, episodesWatched, isFavorite);
      if (existing) {
        await supabase.from('saved_animes').update({ status: newStatus, progress: episodesWatched }).eq('id', existing.id);
      } else {
        await supabase.from('saved_animes').insert(payload);
      }
      setSavedStatus(newStatus);
      setProgress(episodesWatched);
      setPendingStatus(null);
      setIsDropdownOpen(false);
      await refreshSavedAnimes();
      toast.success(`Añadido a ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!session) { openLogin(); return; }
    if (!anime || !savedStatus) return;
    const newFavoriteState = !isFavorite;
    setIsFavorite(newFavoriteState);
    await supabase.from('saved_animes').update({ is_favorite: newFavoriteState }).eq('user_id', session.user.id).eq('anime_id', anime.mal_id);
    await refreshSavedAnimes();
    toast.success(newFavoriteState ? 'Añadido a favoritos' : 'Eliminado de favoritos');
  };

  const handleRemoveAnime = async () => {
    if (!session || !anime) return;
    setIsSaving(true);
    await supabase.from('saved_animes').delete().eq('user_id', session.user.id).eq('anime_id', anime.mal_id);
    setSavedStatus(null);
    setIsFavorite(false);
    setIsSaving(false);
    setIsDropdownOpen(false);
    await refreshSavedAnimes();
    toast.success('Eliminado de tu lista');
  };

  const handleStatusSelect = (status: string) => {
    if (status === 'Mirando') setPendingStatus('Mirando');
    else if (status === 'Completado') handleSaveAnime('Completado', anime?.episodes || 0);
    else handleSaveAnime(status, 0);
  };

  if (loading) return <AnimeDetailsSkeleton />;

  if (notFound) return (
    <div className="flex justify-center items-center h-screen bg-[var(--kr-surface-sunken)] text-zinc-400 font-bold uppercase tracking-widest">
      Registro no encontrado.
    </div>
  );

  if (loadError || !anime) return (
    <div className="flex flex-col items-center justify-center gap-4 h-screen bg-[var(--kr-surface-sunken)] text-zinc-400 font-bold uppercase tracking-widest text-center px-4">
      <p>Error al cargar el anime. Intenta de nuevo.</p>
      <button
        onClick={() => setRetryToken(t => t + 1)}
        className="px-6 py-2.5 border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B] hover:text-[var(--kr-text)] transition-all rounded-xl text-[11px] tracking-widest"
      >
        Reintentar
      </button>
    </div>
  );

  // Solo animes: se descarta manga/novela/etc. de cada grupo de relación, y
  // el grupo entero si queda vacío (p. ej. "Adaptation" suele apuntar solo al manga).
  const filteredRelations = (anime.relations ?? [])
    .filter(rel => rel.relation.toLowerCase() !== 'adaptation')
    .map(rel => ({ ...rel, entry: rel.entry.filter(e => e.type === 'anime') }))
    .filter(rel => rel.entry.length > 0);
  const displayYear = anime.year || (anime.aired?.from ? anime.aired.from.substring(0, 4) : 'TBA');

  return (
    <div className="relative min-h-screen bg-[var(--kr-surface-sunken)] font-sans overflow-hidden">
      <div className="relative z-10 container mx-auto p-4 md:p-8 pt-32 md:pt-36 max-w-[1350px]">

        <AnimeHeroPanel
          anime={anime}
          displayYear={displayYear}
          savedStatus={savedStatus}
          isFavorite={isFavorite}
          isSaving={isSaving}
          isDropdownOpen={isDropdownOpen}
          pendingStatus={pendingStatus}
          progress={progress}
          availableStatuses={getAvailableStatuses()}
          dropdownRef={dropdownRef}
          // Sin sesión, abrir el desplegable no lleva a ningún lado: elegir un
          // estado terminaba en un `return` silencioso. Se ofrece iniciar
          // sesión, que es lo que la persona necesita en ese momento.
          onToggleDropdown={() => {
            if (!session) { openLogin(); return; }
            setIsDropdownOpen(!isDropdownOpen);
          }}
          onToggleFavorite={handleToggleFavorite}
          onStatusSelect={handleStatusSelect}
          onSaveWithProgress={handleSaveAnime}
          onRemove={handleRemoveAnime}
          onPendingStatus={setPendingStatus}
          onProgressChange={setProgress}
          onProgressDecrement={() => handleSaveAnime('Mirando', Math.max(0, progress - 1))}
          onProgressIncrement={() => {
            const newProg = progress + 1;
            if (anime.episodes && newProg >= anime.episodes) handleSaveAnime('Completado', anime.episodes);
            else handleSaveAnime('Mirando', newProg);
          }}
        />

        <RelatedContentSection relations={filteredRelations} imageMap={relatedImages} />
        {/* Todas las plataformas: antes se filtraba a Netflix y Crunchyroll y se
            tiraba el resto, dejando la sección vacía en títulos que sí tienen
            dónde verse (HIDIVE, Prime Video, Disney+, Bilibili). */}
        <StreamingSection streaming={streaming} />
        <TrailerSection trailer={anime.trailer} title={anime.title} />
        <CharactersGrid
          characters={characters}
          animeId={anime.mal_id}
          animeTitle={anime.title}
          currentUserId={session?.user?.id ?? null}
        />
      </div>
    </div>
  );
};
