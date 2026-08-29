import {
  clientIp, getClients, rateLimit, readJsonBody, resolveEmail, sendJson,
  type AuthReq, type AuthRes,
} from '../_lib/auth.js';

// POST /api/auth/login   { identifier, password }  →  { access_token, refresh_token }
//
// `identifier` is either an email or a username. The username→email lookup
// runs here behind the service-role key instead of through a public RPC — see
// the header comment in api/_lib/auth.ts for what that RPC was leaking.
//
// The client takes the returned tokens straight to supabase.auth.setSession(),
// so from that point on the browser holds an ordinary Supabase session and
// every other call in the app keeps working unchanged.

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000;

// One message for "no such user" and for "wrong password" alike. Telling them
// apart is what turns a login form into an account-existence oracle.
const INVALID = 'Usuario o contraseña incorrectos.';

export default async function handler(req: AuthReq, res: AuthRes) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const ip = clientIp(req);
  if (!rateLimit(ip && `login:${ip}`, MAX_ATTEMPTS, WINDOW_MS)) {
    sendJson(res, 429, { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' });
    return;
  }

  const body = await readJsonBody(req);
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!identifier || !password || identifier.length > 320 || password.length > 200) {
    sendJson(res, 400, { error: INVALID });
    return;
  }

  const clients = getClients();
  if (!clients) {
    sendJson(res, 500, { error: 'El servidor no tiene configuradas las credenciales de Supabase.' });
    return;
  }

  const email = await resolveEmail(clients.admin, identifier);
  if (!email) {
    sendJson(res, 400, { error: INVALID });
    return;
  }

  const { data, error } = await clients.anon.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // GoTrue's own throttling surfaces as a distinct status so the user isn't
    // told "wrong password" when the real problem is too many attempts.
    if (error?.status === 429) {
      sendJson(res, 429, { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' });
      return;
    }
    if (error?.message?.includes('Email not confirmed')) {
      sendJson(res, 400, { error: 'Confirmá tu correo antes de iniciar sesión.' });
      return;
    }
    sendJson(res, 400, { error: INVALID });
    return;
  }

  sendJson(res, 200, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
