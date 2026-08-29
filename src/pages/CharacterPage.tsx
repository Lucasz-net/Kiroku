import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Heart, Loader2, Images, Users } from 'lucide-react';
import { getCharacterProfileMal, type CharacterProfile } from '../services/malApi';
import { translateToSpanish } from '../services/translateApi';
import { useFavoriteCharacters } from '../hooks/useFavoriteCharacters';
import { useUserData } from '../contexts/UserDataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/**
 * Página propia del personaje. Antes el detalle solo existía como panel
 * dentro de la ficha del anime, así que no había forma de mandarle a nadie
 * "mirá este personaje".
 *
 * El anime de origen viaja como query param (?anime=id&titulo=...) porque
 * la API de MAL no dice a qué anime pertenece un personaje, y esa relación
 * hace falta para poder guardarlo en favoritos. Si se entra directo por la
 * URL sin esos datos, la página se ve igual pero no se puede marcar.
 */
export const CharacterPage = () => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { session } = useUserData();
  const characterId = Number(id);

  // El estado guarda a qué id pertenece, así "cargando" se deriva en vez de
  // ponerse con un setState dentro del efecto (que encadena un render extra).
  const [loaded, setLoaded] = useState<{ id: number; profile: CharacterProfile | null } | null>(null);
  // La ilustración elegida también recuerda de qué personaje era: así navegar
  // a otro no arrastra la selección anterior ni hace falta resetearla con un
  // setState dentro del efecto.
  const [picked, setPicked] = useState<{ id: number; url: string } | null>(null);
  const loading = loaded?.id !== characterId;
  const profile = loaded?.id === characterId ? loaded.profile : null;
  const activeImage = picked?.id === characterId ? picked.url : null;

  const animeId = Number(params.get('anime')) || null;
  const animeTitle = params.get('titulo') ?? '';

  const { isFavorited, savedImage, toggleFavorite, isFull } = useFavoriteCharacters(
    session?.user?.id ?? null,
  );
  const isFavorite = isFavorited(characterId);

  useDocumentTitle(profile?.name ?? 'Personaje');

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;

    getCharacterProfileMal(characterId)
      .then(result => {
        if (cancelled) return;
        setLoaded({ id: characterId, profile: result });
        if (result?.description) {
          translateToSpanish(result.description)
            .then(translated => {
              if (cancelled) return;
              setLoaded(prev => (prev && prev.id === characterId && prev.profile
                ? { ...prev, profile: { ...prev.profile, description: translated } }
                : prev));
            })
            .catch(() => { /* se queda la biografía original */ });
        }
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setLoaded({ id: characterId, profile: null });
      });

    return () => { cancelled = true; };
  }, [characterId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080A0F] flex justify-center items-center">
        <Loader2 className="animate-spin text-[#FF3B3B]" size={28} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#080A0F] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-black text-white">Personaje no encontrado</h1>
        <p className="text-zinc-500 text-sm max-w-sm">
          Puede que el enlace esté mal o que MyAnimeList ya no tenga esta ficha.
        </p>
        <Link
          to="/search"
          className="flex items-center gap-2 px-6 py-3 bg-[#FF3B3B] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors"
        >
          <ArrowLeft size={14} /> Buscar animes
        </Link>
      </div>
    );
  }

  const shown = activeImage ?? savedImage(characterId) ?? profile.image_url;
  const gallery = [profile.image_url, ...profile.pictures].filter(Boolean).slice(0, 12);
  const canFavorite = !!session && !!animeId;

  return (
    <div className="min-h-screen bg-[#080A0F] font-sans pt-28 md:pt-32 pb-24">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        {animeId ? (
          <Link
            to={`/anime/${animeId}`}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#FF3B3B] text-xs font-bold uppercase tracking-widest transition-colors mb-8"
          >
            <ArrowLeft size={14} /> {animeTitle || 'Volver al anime'}
          </Link>
        ) : (
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#FF3B3B] text-xs font-bold uppercase tracking-widest transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Buscar animes
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
          {/* Retrato + galería */}
          <div className="flex flex-col gap-4">
            <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-[#11131A] border border-[#FF3B3B]/15">
              {shown
                ? <img src={shown} alt={profile.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-zinc-700">
                    {profile.name.charAt(0)}
                  </div>}
            </div>

            {canFavorite && (
              <button
                onClick={() => toggleFavorite({
                  character_id: characterId,
                  name: profile.name,
                  image_url: shown || profile.image_url,
                  anime_id: animeId,
                  anime_title: animeTitle,
                })}
                disabled={!isFavorite && isFull}
                title={!isFavorite && isFull ? 'Ya tenés 12 personajes favoritos' : undefined}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                  isFavorite
                    ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/40 text-[#FF3B3B]'
                    : 'border-[#FF3B3B]/20 text-zinc-400 hover:text-[#FF3B3B] hover:border-[#FF3B3B]/50'
                }`}
              >
                <Heart size={14} className={isFavorite ? 'fill-current' : ''} />
                {isFavorite ? 'En tus favoritos' : 'Marcar como favorito'}
              </button>
            )}

            {gallery.length > 1 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 flex items-center gap-1.5">
                  <Images size={11} /> Ilustraciones
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {gallery.map(url => (
                    <button
                      key={url}
                      onClick={() => setPicked({ id: characterId, url })}
                      className={`aspect-[3/4] rounded-md overflow-hidden border transition-colors ${
                        shown === url ? 'border-[#FF3B3B]' : 'border-[#FF3B3B]/10 hover:border-[#FF3B3B]/40'
                      }`}
                    >
                      <img src={url} alt="" aria-hidden className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ficha */}
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-3">
              {profile.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {profile.favorites !== null && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 bg-[#11131A] border border-[#FF3B3B]/10 px-3 py-1.5 rounded-lg">
                  <Heart size={12} className="text-[#FF3B3B]/60" />
                  {profile.favorites.toLocaleString('es-ES')} favoritos en MyAnimeList
                </span>
              )}
              {animeTitle && (
                <Link
                  to={`/anime/${animeId}`}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[#FF3B3B] bg-[#11131A] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Users size={12} className="text-[#FF3B3B]/60" /> {animeTitle}
                </Link>
              )}
            </div>

            {profile.nicknames.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  También conocido como
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.nicknames.map(n => (
                    <span key={n} className="text-xs font-bold text-zinc-400 bg-[#11131A] border border-[#FF3B3B]/10 px-2.5 py-1 rounded-md">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">
                Biografía
              </p>
              {profile.description ? (
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">
                  {profile.description}
                </p>
              ) : (
                <p className="text-sm text-zinc-600">Sin biografía disponible.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
