-- =====================================================================
-- KIROKU — Security Hardening
-- Ejecutar en: Supabase → SQL Editor → New query
-- =====================================================================
--
-- Qué corrige esto:
--   1. Hoy CUALQUIERA (sin login) puede leer la tabla `profiles` completa,
--      incluyendo el email de TODOS los usuarios, pegándole directo a la
--      REST API de Supabase con la anon key pública. Verificado en vivo.
--      Este script restringe `profiles` a "cada quien lee solo su propia
--      fila completa" y crea una vista `public_profiles` (sin email) para
--      todo lo que la app necesita mostrar públicamente: perfil público,
--      autor de comentarios, seguidores/siguiendo, chequeo de username
--      disponible.
--   2. El login por nombre de usuario necesita poder buscar el email
--      asociado a un username SIN estar autenticado todavía. Se resuelve
--      con una función RPC angosta que devuelve *solo* el email — no la
--      fila completa — para no reabrir el mismo agujero.
--   3. Rate limiting básico en `profile_comments`: un usuario autenticado
--      no puede publicar más de 5 comentarios por minuto (antes no había
--      ningún límite, solo bloqueo de usuarios anónimos).
--
-- Después de correr esto, hace falta actualizar el código de la app para
-- que las lecturas de "otros perfiles" usen `public_profiles` en vez de
-- `profiles` — eso ya está hecho en el mismo cambio que trajo este SQL.


-- ── 1. PROFILES: bloquear lectura pública, permitir solo dueño ─────────
alter table public.profiles enable row level security;

-- Limpia cualquier policy previa (la que hoy permite leer todo) sin
-- necesitar saber su nombre exacto de antemano.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = id );

create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- Defensa en profundidad: si alguna vez la app inserta en `profiles`
-- directamente (hoy lo hace un trigger sobre auth.users, no la app).
create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = id );


-- ── 2. VISTA PÚBLICA: solo columnas no sensibles, todas las filas ──────
-- A propósito NO lleva `security_invoker = true`: la idea es que esta
-- vista sea visible para todos (perfil público, autor de comentario,
-- lista de seguidores) sin pasar por la policy "solo tu propia fila" de
-- arriba. La seguridad acá viene de qué columnas expone la vista
-- (nunca `email`, nunca `username_confirmed`), no de RLS por fila.
create or replace view public.public_profiles as
select id, username, avatar_url, banner_url, bio, created_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;


-- ── 3. LOGIN POR USERNAME: función angosta, no expone la tabla ─────────
create or replace function public.get_email_for_login(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.profiles where username = p_username limit 1;
$$;

revoke all on function public.get_email_for_login(text) from public;
grant execute on function public.get_email_for_login(text) to anon, authenticated;


-- ── 4. RATE LIMIT en comentarios de perfil (5 por minuto) ──────────────
create or replace function public.check_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.profile_comments
    where author_id = new.author_id
      and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'Estás comentando demasiado rápido. Esperá un momento.';
  end if;
  return new;
end;
$$;

drop trigger if exists comment_rate_limit on public.profile_comments;
create trigger comment_rate_limit
  before insert on public.profile_comments
  for each row
  execute function public.check_comment_rate_limit();
