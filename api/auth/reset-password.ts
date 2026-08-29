import {
  clientIp, getClients, missingEnvMessage, rateLimit, readJsonBody, resolveEmail, sendJson, siteUrl,
  type AuthReq, type AuthRes,
} from '../_lib/auth.js';

// POST /api/auth/reset-password   { identifier }  →  { ok: true }
//
// Same reason this isn't done in the browser as /api/auth/login: resolving a
// username to its email needs the service-role key, and that email must never
// travel back to the caller.
//
// The response is 200 with the same body whether or not the account exists —
// the client shows one fixed message either way. Any other shape (a 404, a
// different latency profile, a distinct error) would reintroduce the account
// enumeration this endpoint exists to close.

const MAX_REQUESTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req: AuthReq, res: AuthRes) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const ip = clientIp(req);
  if (!rateLimit(ip && `reset:${ip}`, MAX_REQUESTS, WINDOW_MS)) {
    sendJson(res, 429, { error: 'Demasiadas solicitudes. Esperá unos minutos y probá de nuevo.' });
    return;
  }

  const body = await readJsonBody(req);
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';

  const config = getClients();
  if ('missing' in config) {
    sendJson(res, 500, { error: missingEnvMessage(config.missing) });
    return;
  }
  const clients = config.clients;

  if (identifier && identifier.length <= 320) {
    const email = await resolveEmail(clients.admin, identifier);
    if (email) {
      // redirectTo is built from this deployment's own host, never from
      // anything the client sent — otherwise this is an open redirect that
      // mails an attacker-controlled link to a real user.
      await clients.anon.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl(req)}/restablecer-contrasena`,
      });
    }
  }

  sendJson(res, 200, { ok: true });
}
