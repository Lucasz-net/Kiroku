import { cachedFetch } from '../utils/queryCache';

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MAX_LENGTH = 4000;

// Google's public (unofficial, no API key) translate endpoint. Chosen over
// MyMemory's free tier, which hard-caps requests at 500 characters — most
// anime synopses are longer than that and would need chunking. Verified
// against real synopses up to ~1900 chars in one request, open CORS
// (Access-Control-Allow-Origin: *), and tolerant of a 5-request burst.
// It's unofficial and could change without notice, so every caller must be
// able to fall back to the original English text — never a hard dependency.
async function translateRaw(text: string): Promise<string> {
  const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'es', dt: 't', q: text.slice(0, MAX_LENGTH) });
  const res = await fetch(`${TRANSLATE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
  const json = (await res.json()) as [[string, string, unknown, unknown, number][] | null];
  const segments = json[0];
  if (!segments || segments.length === 0) throw new Error('Empty translation response');
  return segments.map(s => s[0]).join('');
}

// djb2 — short, deterministic key so translations can be cached by content
// without the caller having to invent an id.
function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

// Synopses never change, so cache translations indefinitely (30 days,
// localStorage-persisted) — each anime is translated at most once per browser.
export const translateToSpanish = (text: string): Promise<string> => {
  if (!text || !text.trim()) return Promise.resolve(text);
  return cachedFetch(`es:${hashText(text)}`, () => translateRaw(text), 30 * 24 * 60 * 60 * 1000, true);
};
