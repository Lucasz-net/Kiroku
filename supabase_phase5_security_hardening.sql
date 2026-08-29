-- =====================================================================
-- KIROKU — Fase 5: hardening de seguridad previo al lanzamiento público
-- Ejecutar en: Supabase → SQL Editor → New query
-- APLICADO EN VIVO vía Supabase MCP en la sesión que escribió este
-- archivo — es el registro, no hace falta reejecutarlo.
-- =====================================================================
--
-- Cubre S-2 a S-5 de la auditoría de lanzamiento. S-1 (la fuga de emails
-- por `get_email_for_login`) va aparte, en
-- supabase_phase5_revoke_login_rpc.sql, porque tiene que correrse DESPUÉS
-- de desplegar los endpoints nuevos — leé ese archivo antes de tocarlo.
--
-- Nota de esquema: las funciones auxiliares viven en `private`, no en
-- `public`. Los .sql de fases anteriores dicen `public.can_view_profile`
-- pero la producción usa `private.can_view_profile` desde hace tiempo;
-- este archivo sigue lo que hay en vivo.


-- ── S-2. Validación del lado del servidor ────────────────────────────
-- Hasta acá el formato del username y el largo de la bio solo se
-- validaban en el cliente (USERNAME_RE en ProfileHeader.tsx, maxLength en
-- el textarea). Con la anon key y un PATCH directo a la REST API eso se
-- saltea entero: se podía guardar un username con barras o espacios
-- (rompiendo /u/:username), suplantar a otro con caracteres Unicode
-- parecidos, o dejar una bio de megabytes que después descarga todo el
-- mundo. Verificado antes de correr esto: las filas existentes ya cumplen
-- todas estas restricciones.

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_-]{3,20}$');

-- El cliente corta en 160; 500 deja aire sin dejarlo abierto.
alter table public.profiles
  add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 500);

-- Las URLs de imagen salen de nuestro Storage o del avatar de Google que
-- llega por OAuth: siempre https, nunca javascript: ni data:.
alter table public.profiles
  add constraint profiles_avatar_url_valid
  check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500));

alter table public.profiles
  add constraint profiles_banner_url_valid
  check (banner_url is null or (banner_url ~ '^https://' and char_length(banner_url) <= 500));

alter table public.saved_animes
  add constraint saved_animes_user_score_range
  check (user_score is null or (user_score >= 0 and user_score <= 10));

alter table public.saved_animes
  add constraint saved_animes_progress_range
  check (progress is null or (progress >= 0 and progress <= 10000));

alter table public.saved_animes
  add constraint saved_animes_title_length
  check (char_length(title) between 1 and 500);

-- Privilegios por columna: la RLS ya limita QUÉ fila podés tocar, pero no
-- QUÉ columnas. `email` lo escribe solo el trigger handle_new_user y la
-- app no lo actualiza nunca (verificado en src/), así que sacarlo de la
-- mano del usuario evita que alguien desincronice profiles.email de
-- auth.users — que es justo la columna que resuelve el login por nombre
-- de usuario. `id` y `created_at` tampoco tienen por qué ser editables.
revoke update on public.profiles from authenticated;
grant update (username, username_confirmed, avatar_url, banner_url, bio, is_private)
  on public.profiles to authenticated;

-- anon nunca escribe en profiles (la RLS ya lo bloquea); quitarle también
-- el privilegio es defensa en profundidad, no un cambio de comportamiento.
revoke insert, update, delete on public.profiles from anon;


-- ── S-4. Rate limiting en follows y likes ────────────────────────────
-- Mismo patrón que private.check_comment_rate_limit, que ya existía. Sin
-- esto, un script con un token válido puede inflar los likes de un perfil
-- o seguir mil cuentas por minuto. Los límites son holgados a propósito:
-- tienen que frenar automatización, no a alguien navegando rápido.

create or replace function private.check_follow_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.profile_followers
    where follower_id = new.follower_id
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Estás siguiendo cuentas demasiado rápido. Esperá un momento.';
  end if;
  return new;
end;
$$;

drop trigger if exists follow_rate_limit on public.profile_followers;
create trigger follow_rate_limit
  before insert on public.profile_followers
  for each row execute function private.check_follow_rate_limit();

create or replace function private.check_like_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.profile_likes
    where user_id = new.user_id
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Estás dando likes demasiado rápido. Esperá un momento.';
  end if;
  return new;
end;
$$;

drop trigger if exists like_rate_limit on public.profile_likes;
create trigger like_rate_limit
  before insert on public.profile_likes
  for each row execute function private.check_like_rate_limit();

-- Sobre subir imágenes: no hace falta un trigger equivalente. Desde este
-- cambio cada usuario escribe siempre en la MISMA ruta
-- (`<id>/avatar.webp`, ver S-3), así que resubir sobrescribe en vez de
-- acumular — el techo de almacenamiento por usuario pasa a ser dos
-- archivos, no una cuenta abierta.


-- ── S-5. Comentarios: interruptor por perfil ─────────────────────────
-- Mínimo de moderación para abrir al público: el dueño puede cerrar los
-- comentarios de su perfil. Los que ya existen siguen visibles (y los
-- puede borrar); lo que se corta es publicar nuevos.

alter table public.profiles
  add column if not exists comments_enabled boolean not null default true;

-- SECURITY DEFINER por la misma razón que can_view_profile: la policy
-- necesita leer `profiles` de OTRO usuario, y el RLS de esa tabla es
-- "cada quien lee solo su fila".
create or replace function private.comments_open(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select comments_enabled from public.profiles where id = target_id), true);
$$;

revoke all on function private.comments_open(uuid) from public;
grant execute on function private.comments_open(uuid) to anon, authenticated;

drop policy if exists "comments_insert" on public.profile_comments;
create policy "comments_insert" on public.profile_comments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      private.comments_open(profile_id)
      or (select auth.uid()) = profile_id   -- el dueño siempre puede escribir en el suyo
    )
  );

-- La vista pública tiene que exponer el flag para que el perfil ajeno
-- sepa si mostrar el formulario. CREATE OR REPLACE VIEW no preserva
-- reloptions de forma garantizada, así que —igual que en la fase 0 y la
-- fase 4— se reafirma security_invoker = off explícitamente.
create or replace view public.public_profiles as
select
  p.id,
  p.username,
  p.avatar_url,
  case when private.can_view_profile(p.id) then p.banner_url else null end as banner_url,
  case when private.can_view_profile(p.id) then p.bio else null end as bio,
  p.created_at,
  p.is_private,
  p.comments_enabled
from public.profiles p;

alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to anon, authenticated;


-- ── S-3. Storage: rutas por usuario y borrado ────────────────────────
-- Dos problemas de una: (a) no existía ninguna policy de DELETE, así que
-- ni el dueño podía borrar su propia imagen y cada cambio de avatar
-- dejaba el archivo anterior público para siempre; (b) las policies de
-- escritura solo miraban `owner`, no la ruta, así que un usuario podía
-- escribir en cualquier nombre libre del bucket.
--
-- A partir de acá se escribe solo dentro de `<tu-uuid>/…`. El DELETE, en
-- cambio, se gatea por `owner` y no por ruta a propósito: los archivos
-- del esquema viejo están en la raíz del bucket y hay que poder
-- limpiarlos.

drop policy if exists "INSERT/UPDATE 1oj01fe_0" on storage.objects;
drop policy if exists "INSERT/UPDATE 1oj01fe_1" on storage.objects;
drop policy if exists "INSERT/UPDATE 1oj01fe_2" on storage.objects;
drop policy if exists "banners_insert_own"      on storage.objects;
drop policy if exists "banners_update_own"      on storage.objects;

create policy "profile_images_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile_images_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile_images_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (select auth.uid()) = owner
  );
