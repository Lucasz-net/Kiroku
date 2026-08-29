import { createClient } from '@supabase/supabase-js';

// POST /api/account/delete
// Deletes the calling user's own account, permanently and in cascade —
// profiles/saved_animes/profile_followers/profile_likes/profile_comments
// (including comments they left on OTHER people's profiles) all have
// `ON DELETE CASCADE` FKs down to auth.users, so removing the auth.users
// row via the Admin API is enough to wipe every row, no anonymization.
//
// Storage is NOT covered by that cascade, so the avatar and banner are
// removed explicitly first. Without this the account's photos stayed
// publicly reachable by URL after the person asked for all their data to be
// deleted, which is both a privacy failure and a contradiction of the
// privacy policy.
//
// Needs the service-role key, so this can't run client-side — same reason
// api/mal/* exists as a proxy: the secret must never reach the browser.
// The account to delete is resolved from the caller's own access token,
// never from a client-supplied id, so this can only ever delete the
// account making the request.

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function sendJson(res: Res, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization ?? req.headers.Authorization;
  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = rawHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    sendJson(res, 401, { error: 'Falta el token de sesión.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(res, 500, { error: 'El servidor no tiene configuradas las credenciales de Supabase.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    sendJson(res, 401, { error: 'Sesión inválida o expirada.' });
    return;
  }

  const userId = userData.user.id;

  // Two layouts to clean up: the current one (`<id>/avatar.webp`, listed by
  // folder) and the original one (`<id>-<timestamp>.webp` at the bucket root,
  // which can have several leftovers per user). Best-effort on purpose — a
  // Storage hiccup must not leave the person with an account they asked to
  // have deleted.
  for (const bucket of ['avatars', 'banners'] as const) {
    try {
      const [inFolder, atRoot] = await Promise.all([
        admin.storage.from(bucket).list(userId),
        admin.storage.from(bucket).list('', { search: userId }),
      ]);
      const paths = [
        ...(inFolder.data ?? []).map(f => `${userId}/${f.name}`),
        ...(atRoot.data ?? [])
          .filter(f => f.name.startsWith(`${userId}-`))
          .map(f => f.name),
      ];
      if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
    } catch (err) {
      console.error(`No se pudieron borrar los archivos de ${bucket}:`, err);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    sendJson(res, 500, { error: deleteError.message });
    return;
  }

  sendJson(res, 200, { success: true });
}
