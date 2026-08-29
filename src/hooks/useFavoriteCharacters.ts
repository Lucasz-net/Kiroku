import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { FavoriteCharacter } from '../types/profile';

/** Tope por perfil. El que manda es el trigger homónimo en la base. */
export const FAVORITE_CHARACTERS_LIMIT = 12;

// `character_id` es siempre un id de personaje de MyAnimeList: tanto Jikan
// (espejo de MAL) como la API oficial devuelven ese mismo espacio de ids, así
// que no hace falta guardar de qué fuente vino cada favorito.
export interface FavoriteCharacterInput {
  character_id: number;
  name: string;
  image_url: string;
  anime_id: number;
  anime_title: string;
}

export function useFavoriteCharacters(userId: string | null) {
  const [entries, setEntries] = useState<FavoriteCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!userId) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('profile_favorite_characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setEntries((data as FavoriteCharacter[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries();
  }, [fetchEntries]);

  const isFavorited = useCallback(
    (characterId: number) => entries.some(e => e.character_id === characterId),
    [entries],
  );

  /** Imagen guardada para ese personaje, o null si no está en favoritos. */
  const savedImage = useCallback(
    (characterId: number) => entries.find(e => e.character_id === characterId)?.image_url ?? null,
    [entries],
  );

  // Cambia la portada que el perfil muestra para un personaje ya guardado.
  // La fila guarda la URL denormalizada, así que elegir otra ilustración de
  // la galería es solo reescribir ese campo.
  const updateImage = async (characterId: number, imageUrl: string) => {
    if (!userId) return;
    const existing = entries.find(e => e.character_id === characterId);
    if (!existing || existing.image_url === imageUrl) return;

    setEntries(prev => prev.map(e => (e.character_id === characterId ? { ...e, image_url: imageUrl } : e)));
    const { error } = await supabase
      .from('profile_favorite_characters')
      .update({ image_url: imageUrl })
      .eq('id', existing.id);
    if (error) {
      setEntries(prev => prev.map(e => (e.character_id === characterId ? existing : e)));
    }
  };

  // Optimista en ambos sentidos: el corazón responde al instante y solo se
  // revierte si Supabase rechaza la escritura.
  const toggleFavorite = async (character: FavoriteCharacterInput) => {
    if (!userId) return;
    const existing = entries.find(e => e.character_id === character.character_id);

    if (existing) {
      setEntries(prev => prev.filter(e => e !== existing));
      const { error } = await supabase.from('profile_favorite_characters').delete().eq('id', existing.id);
      if (error) setEntries(prev => [...prev, existing]);
      return;
    }

    // El tope real lo impone un trigger en la base; esto evita el viaje de
    // ida y vuelta y da un mensaje claro en vez del error crudo de Postgres.
    if (entries.length >= FAVORITE_CHARACTERS_LIMIT) {
      toast.error(`Llegaste al máximo de ${FAVORITE_CHARACTERS_LIMIT} personajes favoritos. Quitá uno para agregar otro.`);
      return;
    }

    const optimistic: FavoriteCharacter = { ...character, user_id: userId };
    setEntries(prev => [optimistic, ...prev]);
    const { data, error } = await supabase
      .from('profile_favorite_characters')
      .insert({ user_id: userId, ...character })
      .select('*')
      .single();
    if (error) {
      setEntries(prev => prev.filter(e => e !== optimistic));
      toast.error(
        error.message.includes('máximo')
          ? error.message
          : 'No se pudo guardar el personaje.',
      );
    } else {
      setEntries(prev => prev.map(e => (e === optimistic ? (data as FavoriteCharacter) : e)));
    }
  };

  return {
    entries, loading, isFavorited, savedImage, toggleFavorite, updateImage,
    limit: FAVORITE_CHARACTERS_LIMIT,
    isFull: entries.length >= FAVORITE_CHARACTERS_LIMIT,
  };
}
