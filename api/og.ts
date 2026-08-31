import { createClient } from '@supabase/supabase-js';

// GET /api/og?type=profile&id=<username>
// GET /api/og?type=anime&id=<malId>
//
// Devuelve un HTML mínimo con los meta tags de Open Graph del recurso pedido.
// Solo lo reciben los rastreadores de vistas previas: la reescritura en
// vercel.json manda acá únicamente cuando el user-agent es un bot conocido,
// así que una persona nunca ve esta página.
//
// Por qué hace falta: Kiroku es una SPA, los bots de vista previa no ejecutan
// JavaScript, y los meta tags estáticos del index.html no pueden describir un
// perfil o un anime en particular. El resultado era que el botón "Compartir
// perfil" repartía links que se pegaban como una URL pelada.
//
// El HTML igual incluye un enlace y un redirect por meta refresh, para que si
// una persona llega hasta acá por accidente termine en la página real.

interface OgReq { url?: string; headers: Record<string, string | string[] | undefined> }
interface OgRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

const SITE = () => (process.env.SITE_URL || 'https://kiroku.pro').replace(/\/$/, '');

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Recorta sin cortar una palabra al medio. */
const truncate = (value: string, max: number) => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') || max)}…`;
};

interface OgData { title: string; description: string; image: string; url: string }

function render(data: OgData): string {
  const site = SITE();
  const image = data.image?.startsWith('http') ? data.image : `${site}/logo.png`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title)}</title>
<meta name="description" content="${escapeHtml(data.description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kiroku">
<meta property="og:title" content="${escapeHtml(data.title)}">
<meta property="og:description" content="${escapeHtml(data.description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(data.url)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(data.url)}">
</head>
<body><a href="${escapeHtml(data.url)}">${escapeHtml(data.title)}</a></body>
</html>`;
}

async function profileData(username: string): Promise<OgData | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  // `public_profiles` ya oculta el email y respeta la privacidad del perfil:
  // de uno privado devuelve el nombre y el avatar, pero no la bio.
  const { data } = await supabase
    .from('public_profiles')
    .select('username, avatar_url, bio, is_private')
    .ilike('username', username.replace(/[\\%_]/g, m => `\\${m}`))
    .maybeSingle();

  if (!data) return null;

  return {
    title: `@${data.username} en Kiroku`,
    description: data.bio
      ? truncate(data.bio, 160)
      : data.is_private
        ? 'Perfil privado. Seguilo para ver su lista y sus estadísticas.'
        : 'Mirá su lista de anime, sus estadísticas y su Top 10.',
    image: data.avatar_url || '',
    url: `${SITE()}/u/${encodeURIComponent(data.username)}`,
  };
}

async function animeData(malId: string): Promise<OgData | null> {
  const query = `query ($id: Int) {
    Media(idMal: $id, type: ANIME) {
      title { romaji english }
      description(asHtml: false)
      coverImage { extraLarge large }
      episodes
      seasonYear
    }
  }`;

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: Number(malId) } }),
  });
  if (!res.ok) return null;

  const json = await res.json() as {
    data?: { Media?: {
      title: { romaji: string | null; english: string | null };
      description: string | null;
      coverImage: { extraLarge: string | null; large: string | null } | null;
      episodes: number | null;
      seasonYear: number | null;
    } | null };
  };
  const media = json.data?.Media;
  if (!media) return null;

  const title = media.title.romaji || media.title.english || 'Anime';
  const bits = [media.seasonYear, media.episodes ? `${media.episodes} episodios` : null]
    .filter(Boolean).join(' · ');

  return {
    title: `${title} — Kiroku`,
    description: media.description
      ? truncate(media.description.replace(/<[^>]+>/g, ' '), 160)
      : bits || 'Seguí este anime en Kiroku.',
    image: media.coverImage?.extraLarge || media.coverImage?.large || '',
    url: `${SITE()}/anime/${encodeURIComponent(malId)}`,
  };
}

export default async function handler(req: OgReq, res: OgRes) {
  const url = new URL(req.url || '', 'http://internal');
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id') ?? '';

  let data: OgData | null = null;
  try {
    if (type === 'profile' && id) data = await profileData(id);
    else if (type === 'anime' && /^\d+$/.test(id)) data = await animeData(id);
  } catch (err) {
    console.error('og render failed:', err);
  }

  // Sin datos igual se responde algo válido: una vista previa genérica es
  // mejor que un 500 en la tarjeta del enlace.
  const fallback: OgData = {
    title: 'Kiroku — Tu tracker personal de anime',
    description: 'Buscá, seguí y llevá estadísticas de los animes que ves.',
    image: `${SITE()}/logo.png`,
    url: SITE(),
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.end(render(data ?? fallback));
}
