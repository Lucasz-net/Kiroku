// Shared helpers for the /api/auth/* endpoints. Not itself a route — Vercel
// skips files/folders under /api prefixed with "_".
//
// Why these endpoints exist at all: logging in with a *username* needs to
// resolve that username to the account's email before GoTrue can be called,
// and that lookup can't happen in the browser. It used to run through the
// `get_email_for_login` RPC with `execute` granted to `anon`, which meant any
// anonymous visitor could POST a username to /rest/v1/rpc/get_email_for_login
// and get that account's email back — and usernames are enumerable from the
// public `public_profiles` view, so the whole email base was scrapeable.
// Verified against the live project before this was written.
//
// Now the lookup happens here, behind the service-role key, and the email is
// never part of any response — the endpoints answer with a session or with a
// deliberately uninformative error.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Minimal Node request/response shape satisfied by both the Vercel serverless
// runtime and the Vite dev-server middleware (see vite.config.ts), so the
// handlers run unchanged in both — same approach as api/_lib/mal.ts.
export interface AuthReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  /** Vercel pre-parses JSON bodies; the dev middleware doesn't. */
  body?: unknown;
  on?(event: string, listener: (chunk?: unknown) => void): unknown;
}

export interface AuthRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export function sendJson(res: AuthRes, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 4096;

/** Reads a JSON body from either runtime. Returns {} for anything unparseable. */
export async function readJsonBody(req: AuthReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  if (typeof req.on !== 'function') return {};

  const raw = await new Promise<string>(resolve => {
    let data = '';
    let tooBig = false;
    req.on!('data', (chunk?: unknown) => {
      if (tooBig) return;
      data += String(chunk);
      if (data.length > MAX_BODY_BYTES) { tooBig = true; data = ''; }
    });
    req.on!('end', () => resolve(data));
    req.on!('error', () => resolve(''));
  });

  try { return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; } catch { return {}; }
}

export function firstHeader(req: AuthReq, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
}

/**
 * Caller's IP, or null when no proxy header identifies it (the dev server,
 * mainly). Callers must skip throttling on null rather than lumping everyone
 * into one shared bucket — doing that would let a handful of requests lock out
 * every other user at once. GoTrue's own per-account limiting stays in the
 * path either way, so nothing is left completely unprotected.
 */
export function clientIp(req: AuthReq): string | null {
  return firstHeader(req, 'x-forwarded-for')
    ?? firstHeader(req, 'x-real-ip')
    ?? null;
}

// Best-effort in-memory throttle. Serverless instances are ephemeral and there
// can be several warm at once, so this only slows an attacker down within a
// single instance — the real backstop is GoTrue's own per-account rate
// limiting, which these endpoints deliberately keep in the path by calling
// signInWithPassword / resetPasswordForEmail rather than reimplementing them.
const hits = new Map<string, number[]>();

export function rateLimit(key: string | null, max: number, windowMs: number): boolean {
  if (key === null) return true;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived warm instance.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every(t => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

interface Clients { admin: SupabaseClient; anon: SupabaseClient }

/**
 * Service-role client for the username→email lookup, plus a plain anon client
 * for the actual GoTrue call. The sign-in has to go through the anon client so
 * the session it returns is an ordinary user session, not a privileged one.
 *
 * Returns the list of MISSING variable names instead of a bare null: a generic
 * "credentials not configured" 500 sent us chasing the wrong variable once
 * already. Naming a config key leaks nothing — the values never appear.
 *
 * The anon key is read under either name because it's the one variable whose
 * `VITE_` prefix is there for the browser build, not for this function; a
 * project that names it without the prefix server-side is just as correct.
 */
export function getClients(): { clients: Clients } | { missing: string[] } {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length > 0) return { missing };

  const opts = { auth: { autoRefreshToken: false, persistSession: false } };
  return {
    clients: {
      admin: createClient(url!, serviceRoleKey!, opts),
      anon: createClient(url!, anonKey!, opts),
    },
  };
}

/** Mensaje de 500 que nombra la variable que falta, para no adivinar. */
export function missingEnvMessage(missing: string[]): string {
  return `Faltan variables de entorno en el servidor: ${missing.join(', ')}. `
    + 'Definilas en Vercel → Settings → Environment Variables y volvé a desplegar '
    + '(los cambios de variables no se aplican a deploys ya existentes).';
}

/**
 * Turns whatever the user typed into the email GoTrue needs. An identifier
 * containing "@" is taken at face value; anything else is looked up as a
 * username, case-insensitively (the DB's uniqueness index is on
 * `lower(username)`, so the lookup has to match that).
 *
 * Returns null when the username doesn't exist. Callers must NOT surface that
 * distinction to the client — see the uniform error messages in login.ts and
 * the always-200 response in reset-password.ts.
 */
export async function resolveEmail(admin: SupabaseClient, identifier: string): Promise<string | null> {
  if (identifier.includes('@')) return identifier;

  const { data } = await admin
    .from('profiles')
    .select('email')
    .ilike('username', identifier)
    .limit(1)
    .maybeSingle();

  return (data?.email as string | undefined) ?? null;
}

/**
 * Absolute URL of this deployment, built from the request rather than from
 * anything the client sends — a client-supplied redirect target would make the
 * password-reset endpoint an open redirect.
 */
export function siteUrl(req: AuthReq): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = firstHeader(req, 'x-forwarded-host') ?? firstHeader(req, 'host');
  // Solo se llega acá si no hay ningún header de host, cosa que en Vercel no
  // pasa. Definí SITE_URL si algún día el sitio se muda de dominio.
  if (!host) return 'https://kiroku.pro';
  const proto = firstHeader(req, 'x-forwarded-proto')
    ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}
