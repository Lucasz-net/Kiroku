-- =====================================================================
-- KIROKU — Fase 4: perfiles privados
-- Ejecutar en: Supabase → SQL Editor → New query
-- YA APLICADO EN VIVO vía Supabase MCP durante la sesión que escribió
-- este archivo — es solo el registro. No lo corras de nuevo (el `alter
-- table add column` usa `if not exists` así que no rompería nada, pero
-- las policies se dropean y recrean, no hace falta reejecutar).
-- =====================================================================
--
-- Qué hace esto:
--   `profiles.is_private` (default false). Cuando está en true, alguien
--   que NO sea el dueño del perfil y NO lo siga ve solo username +
--   avatar — bio, banner, stats, lista de animes guardados,
--   seguidores/siguiendo y comentarios quedan ocultos hasta que empiece
--   a seguirlo. No hay flujo de "solicitud/aprobación": seguir a alguien
--   privado funciona igual que a cualquiera, y en el instante en que la
--   fila de follow existe, `can_view_profile` ya lo empieza a considerar
--   visible.
--
-- Por qué una función y no solo RLS: `public_profiles` corre con
-- security_invoker=off (a propósito, ver supabase_security_hardening.sql)
-- para poder exponer datos no sensibles de CUALQUIER perfil sin pasar
-- por el RLS de `profiles` ("cada quien lee solo su fila"). Eso significa
-- que el gateo de privacidad no puede vivir en el RLS de `profiles` —
-- tiene que ser una función SECURITY DEFINER que la vista y las policies
-- de las otras tablas (saved_animes, profile_followers, profile_comments,
-- profile_likes) llaman explícitamente.

-- ── 1. Columna is_private ────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_private boolean not null default false;

-- ── 2. Función de visibilidad ────────────────────────────────────────
create or replace function public.can_view_profile(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_id = auth.uid()
    or not coalesce((select is_private from public.profiles where id = target_id), false)
    or exists (
      select 1 from public.profile_followers
      where follower_id = auth.uid() and following_id = target_id
    );
$$;

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to anon, authenticated;

-- ── 3. public_profiles: exponer is_private, ocultar bio/banner si corresponde ──
create or replace view public.public_profiles as
select
  p.id,
  p.username,
  p.avatar_url,
  case when public.can_view_profile(p.id) then p.banner_url else null end as banner_url,
  case when public.can_view_profile(p.id) then p.bio else null end as bio,
  p.created_at,
  p.is_private
from public.profiles p;

-- Recordatorio de la Fase 0: CREATE OR REPLACE VIEW no garantiza
-- preservar reloptions — reafirmar security_invoker=off explícitamente
-- cada vez que se toca esta vista.
alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to anon, authenticated;

-- ── 4. saved_animes: una sola policy de SELECT gateada ───────────────
-- (reemplaza las 2 policies previas: "Public read on saved_animes" que
-- era USING(true) para todo el mundo, y "Users can view their own saved
-- animes" que ya era redundante contra esa).
drop policy if exists "Public read on saved_animes" on public.saved_animes;
drop policy if exists "Users can view their own saved animes" on public.saved_animes;
create policy "saved_animes_select" on public.saved_animes
  for select
  to anon, authenticated
  using ( public.can_view_profile(user_id) );

-- ── 5. profile_followers: fila visible solo si AMBOS extremos lo son ──
-- Diseño: una relación de follow se oculta si cualquiera de las dos
-- puntas es un perfil privado que el viewer no sigue — así un usuario
-- privado no aparece ni en su propia lista de seguidores/siguiendo ni
-- en la lista pública de otra persona, para quien no lo sigue.
drop policy if exists "followers_select" on public.profile_followers;
create policy "followers_select" on public.profile_followers
  for select
  to public
  using ( public.can_view_profile(follower_id) and public.can_view_profile(following_id) );

-- ── 6. profile_comments: gateado por el dueño del perfil comentado ───
drop policy if exists "comments_select" on public.profile_comments;
create policy "comments_select" on public.profile_comments
  for select
  to public
  using ( public.can_view_profile(profile_id) );

-- ── 7. profile_likes: gateado por el dueño del perfil likeado ────────
drop policy if exists "likes_select" on public.profile_likes;
create policy "likes_select" on public.profile_likes
  for select
  to public
  using ( public.can_view_profile(profile_id) );
