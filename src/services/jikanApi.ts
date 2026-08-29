import { cachedFetch } from '../utils/queryCache';
import type { JikanResponse, JikanFullResponse } from '../types/anime';

const BASE_URL = 'https://api.jikan.moe/v4';

// Thrown when a Jikan request fails, carrying the HTTP status so callers
// can distinguish a real 404 (not found) from rate limits / network errors.
export class JikanError extends Error {
  status: number;
  constructor(status: number) {
    super(`Jikan request failed with status ${status}`);
    this.name = 'JikanError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Jikan's public API has essentially no tolerance for concurrent bursts —
// a single anime-details page fires 3 requests at once (full data,
// characters, streaming) and Home fires 3 more (upcoming, top-rated,
// top-popular). Verified against the live API: 3 of 5 simultaneous requests
// came back 429, with no Retry-After header. Left uncoordinated, each of
// those requests retries on its own schedule and they keep re-colliding.
// Routing every call through this single-lane queue means the app only ever
// has one Jikan request in flight, paced to stay under the rate limit, so
// bursts turn into a short queue instead of a wall of 429s.
const MIN_GAP_MS = 380;
let queue: Promise<void> = Promise.resolve();
let cooldownUntil = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) await sleep(wait);
    return task();
  });
  // Keep the queue alive regardless of outcome, paced by MIN_GAP_MS so the
  // *next* request never lands right on top of this one.
  queue = result.then(() => undefined, () => undefined).then(() => sleep(MIN_GAP_MS));
  return result;
}

// Two retries beyond the first attempt. 429 also pauses the whole queue
// briefly (Jikan gives no Retry-After header, so a fixed cooldown is the
// only signal we have) — 5xx (e.g. the "Jikan failed to connect to
// MyAnimeList" 504 seen in practice) only backs off the individual request.
async function fetchWithRetry(url: string): Promise<Response> {
  const RETRY_DELAYS = [600, 1400];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      cooldownUntil = Date.now() + 1500;
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(1500);
      continue;
    }
    if (res.status >= 500) {
      if (attempt >= RETRY_DELAYS.length) return res;
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    return res;
  }
}

function jikanFetch(url: string): Promise<Response> {
  return enqueue(() => fetchWithRetry(url));
}

async function jikanGet<T>(url: string): Promise<T> {
  const res = await jikanFetch(url);
  if (!res.ok) throw new JikanError(res.status);
  return res.json() as Promise<T>;
}

// Lightweight media lookup (image only) used for related-content thumbnails.
// Goes through the same queue + cache as every other Jikan call instead of
// a raw, unthrottled fetch.
export const getMediaImage = (type: 'anime' | 'manga', id: number) =>
  cachedFetch<{ data: { images?: { jpg?: { image_url?: string; large_image_url?: string } } } }>(
    `media:${type}:${id}`,
    () => jikanGet(`${BASE_URL}/${type}/${id}`),
    60 * 60 * 1000,
    true,
  );

export const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { year, season: 'winter', label: 'Invierno' };
  if (month <= 6) return { year, season: 'spring', label: 'Primavera' };
  if (month <= 9) return { year, season: 'summer', label: 'Verano' };
  return            { year, season: 'fall',   label: 'Otoño' };
};

export const getAnimeById = (id: string): Promise<JikanFullResponse> =>
  cachedFetch(`anime:${id}`, () => jikanGet(`${BASE_URL}/anime/${id}/full`), 30 * 60 * 1000);

export const getAnimeStreaming = (id: string): Promise<{ data: { name: string; url: string }[] }> =>
  cachedFetch(
    `streaming:${id}`,
    () => jikanGet(`${BASE_URL}/anime/${id}/streaming`),
    60 * 60 * 1000,
    true,
  );

// Rank/popularity/score (Home, RankingPage, AnimeDetails badges) now come
// from MyAnimeList's official API — see src/services/malApi.ts — not from
// here. Jikan is still used below for anime details fallback, characters,
// streaming, and studio/search lookups.

export const getAnimeByStudio = (studioId: string) =>
  cachedFetch(
    `studio:${studioId}`,
    () => jikanGet(`${BASE_URL}/anime?producers=${studioId}&order_by=score&sort=desc&sfw=true`),
    15 * 60 * 1000,
  );

export interface AdvancedSearchFilters {
  q?: string;
  type?: string;
  status?: string;
  genres?: string;
  producers?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  page?: number;
}

export const advancedSearchAnime = (filters: AdvancedSearchFilters) => {
  const params = new URLSearchParams();
  params.append('sfw', 'true');
  if (!filters.q) { params.append('order_by', 'score'); params.append('sort', 'desc'); }
  if (filters.q)          params.append('q',          filters.q);
  if (filters.type)       params.append('type',       filters.type);
  if (filters.status)     params.append('status',     filters.status);
  if (filters.genres)     params.append('genres',     filters.genres);
  if (filters.producers)  params.append('producers',  filters.producers);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date)   params.append('end_date',   filters.end_date);
  if (filters.limit)      params.append('limit',      filters.limit.toString());
  if (filters.page)       params.append('page',       filters.page.toString());
  return cachedFetch<JikanResponse>(
    `adv:${params.toString()}`,
    () => jikanGet(`${BASE_URL}/anime?${params.toString()}`),
    5 * 60 * 1000,
  );
};

export const getSeasonLabel = (season: string): string => {
  const labels: Record<string, string> = { winter: 'Invierno', spring: 'Primavera', summer: 'Verano', fall: 'Otoño' };
  return labels[season] || season;
};
