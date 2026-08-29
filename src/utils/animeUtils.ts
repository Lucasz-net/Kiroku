import type { SavedAnime, UserStats } from '../types/profile';
import type { AnimeFull } from '../types/anime';

export const parseDurationToMinutes = (durationStr?: string | null): number => {
  if (!durationStr || durationStr === 'Unknown') return 24;
  let totalMin = 0;
  const hrMatch = durationStr.match(/(\d+)\s*hr/);
  if (hrMatch) totalMin += parseInt(hrMatch[1], 10) * 60;
  const minMatch = durationStr.match(/(\d+)\s*min/);
  if (minMatch) totalMin += parseInt(minMatch[1], 10);
  return totalMin > 0 ? totalMin : 24;
};

// Shared by Profile.tsx (own list) and PublicProfilePage.tsx (someone else's) --
// both rendered the exact same aggregation inline before this was extracted.
export const computeUserStats = (animes: SavedAnime[]): UserStats => {
  let episodes = 0, minutes = 0, completed = 0, favorites = 0, pending = 0, watching = 0;
  const genreCounts: Record<string, number> = {};
  const studioCounts: Record<string, number> = {};

  animes.forEach(anime => {
    if (anime.is_favorite) favorites++;
    if (anime.status === 'Pendiente') pending++;
    let epsWatched = 0;
    if (anime.status === 'Completado') {
      completed++;
      epsWatched = anime.episodes_total || anime.progress || 1;
      anime.genres?.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
      anime.studios?.forEach(s => { studioCounts[s] = (studioCounts[s] || 0) + 1; });
    } else if (anime.status === 'Mirando') {
      watching++;
      epsWatched = anime.progress || 0;
    }
    if (epsWatched > 0) {
      episodes += epsWatched;
      minutes += epsWatched * parseDurationToMinutes(anime.duration);
    }
  });

  return {
    episodes, minutes,
    hours: Math.floor(minutes / 60),
    days: (minutes / 1440).toFixed(1),
    completed, pending, watching, favorites,
    topGenres: Object.entries(genreCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5),
    topStudios: Object.entries(studioCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5),
  };
};

// Shape of the row upserted into `saved_animes` when a user adds/updates an
// anime on their list -- extracted from AnimeDetails.tsx's handleSaveAnime
// so the payload logic is testable without a Supabase client.
export const buildSavedAnimePayload = (
  anime: AnimeFull,
  userId: string,
  status: string,
  episodesWatched: number,
  isFavorite: boolean,
) => ({
  status,
  progress: episodesWatched,
  user_id: userId,
  anime_id: anime.mal_id,
  title: anime.title,
  image_url: anime.images.jpg.image_url,
  episodes_total: anime.episodes,
  score: anime.score,
  is_favorite: isFavorite,
  genres: anime.genres?.map(g => g.name) || [],
  studios: anime.studios?.map(s => s.name) || [],
  duration: anime.duration || null,
});

export const getHighResImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (!url.includes('cdn.myanimelist.net')) return url;
  // MAL CDN: suffix 'l' = large, 't' = tiny, no suffix = standard.
  // Always upgrade to 'l' (largest available) and prefer webp when already webp.
  return url.replace(/(?:[lt])?\.(jpg|webp)$/i, 'l.$1');
};
