import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, computeUserStats, buildSavedAnimePayload } from './animeUtils';
import type { SavedAnime } from '../types/profile';
import type { AnimeFull } from '../types/anime';

describe('parseDurationToMinutes', () => {
  it('parses "1 hr 30 min" formats', () => {
    expect(parseDurationToMinutes('1 hr 30 min')).toBe(90);
  });

  it('parses minutes-only formats', () => {
    expect(parseDurationToMinutes('24 min per ep')).toBe(24);
  });

  it('falls back to 24 for missing/unknown duration', () => {
    expect(parseDurationToMinutes(null)).toBe(24);
    expect(parseDurationToMinutes(undefined)).toBe(24);
    expect(parseDurationToMinutes('Unknown')).toBe(24);
  });

  it('falls back to 24 when the string has no parseable number', () => {
    expect(parseDurationToMinutes('N/A')).toBe(24);
  });
});

const makeAnime = (overrides: Partial<SavedAnime> = {}): SavedAnime => ({
  id: crypto.randomUUID(),
  anime_id: 1,
  title: 'Test Anime',
  image_url: '',
  status: 'Completado',
  episodes_total: 12,
  score: null,
  is_favorite: false,
  year: 2020,
  genres: [],
  studios: [],
  duration: '24 min',
  progress: 0,
  // Spread last so an explicit `null`/`0` override always wins over the
  // defaults above (a plain `??` per-field would ignore an explicit null).
  ...overrides,
});

describe('computeUserStats', () => {
  it('returns all-zero stats for an empty list', () => {
    const stats = computeUserStats([]);
    expect(stats).toMatchObject({
      episodes: 0, minutes: 0, hours: 0, days: '0.0',
      completed: 0, pending: 0, watching: 0, favorites: 0,
      topGenres: [], topStudios: [],
    });
  });

  it('counts completed episodes/minutes and credits genres/studios only for completed entries', () => {
    const animes = [
      makeAnime({ status: 'Completado', episodes_total: 12, duration: '24 min', genres: ['Action'], studios: ['MAPPA'] }),
      makeAnime({ status: 'Mirando', progress: 5, duration: '24 min', genres: ['Drama'] }),
      makeAnime({ status: 'Pendiente', genres: ['Comedy'] }),
    ];
    const stats = computeUserStats(animes);

    expect(stats.completed).toBe(1);
    expect(stats.watching).toBe(1);
    expect(stats.pending).toBe(1);
    // 12 completed eps + 5 watched eps, all at 24 min/ep
    expect(stats.episodes).toBe(17);
    expect(stats.minutes).toBe(17 * 24);
    // "Mirando"/"Pendiente" entries must NOT contribute to topGenres/topStudios
    expect(stats.topGenres).toEqual([{ label: 'Action', count: 1 }]);
    expect(stats.topStudios).toEqual([{ label: 'MAPPA', count: 1 }]);
  });

  it('counts a favorite regardless of status', () => {
    const animes = [makeAnime({ status: 'Pendiente', is_favorite: true })];
    expect(computeUserStats(animes).favorites).toBe(1);
  });

  it('falls back to progress, then to 1, when a completed anime has no episodes_total', () => {
    const withProgress = computeUserStats([makeAnime({ status: 'Completado', episodes_total: null as unknown as number, progress: 8 })]);
    expect(withProgress.episodes).toBe(8);

    const withNeither = computeUserStats([makeAnime({ status: 'Completado', episodes_total: null as unknown as number, progress: 0 })]);
    expect(withNeither.episodes).toBe(1);
  });

  it('sorts topGenres/topStudios by count descending and caps at 5', () => {
    const animes = Array.from({ length: 6 }, (_, i) =>
      makeAnime({ status: 'Completado', genres: [`Genre${i}`, 'Common'] }),
    );
    const stats = computeUserStats(animes);
    expect(stats.topGenres).toHaveLength(5);
    expect(stats.topGenres[0]).toEqual({ label: 'Common', count: 6 });
  });
});

const makeAnimeFull = (overrides: Partial<AnimeFull> = {}): AnimeFull => ({
  mal_id: 42,
  title: 'Shingeki no Kyojin',
  episodes: 25,
  images: { jpg: { image_url: 'img.jpg', large_image_url: 'img_l.jpg' } },
  synopsis: '...',
  year: 2013,
  status: 'Finished Airing',
  studios: [{ mal_id: 1, name: 'Wit Studio' }],
  genres: [{ mal_id: 1, name: 'Action' }],
  score: 8.5,
  duration: '24 min',
  ...overrides,
});

describe('buildSavedAnimePayload', () => {
  it('maps an AnimeFull + user selection into a saved_animes row', () => {
    const payload = buildSavedAnimePayload(makeAnimeFull(), 'user-123', 'Mirando', 7, true);
    expect(payload).toEqual({
      status: 'Mirando',
      progress: 7,
      user_id: 'user-123',
      anime_id: 42,
      title: 'Shingeki no Kyojin',
      image_url: 'img.jpg',
      episodes_total: 25,
      score: 8.5,
      is_favorite: true,
      genres: ['Action'],
      studios: ['Wit Studio'],
      duration: '24 min',
    });
  });

  it('defaults genres/studios to empty arrays and duration to null when absent', () => {
    const payload = buildSavedAnimePayload(
      makeAnimeFull({ genres: undefined as unknown as AnimeFull['genres'], studios: undefined as unknown as AnimeFull['studios'], duration: undefined }),
      'user-123', 'Completado', 25, false,
    );
    expect(payload.genres).toEqual([]);
    expect(payload.studios).toEqual([]);
    expect(payload.duration).toBeNull();
  });
});
