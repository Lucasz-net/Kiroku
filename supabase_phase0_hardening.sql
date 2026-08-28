-- =====================================================================
-- KIROKU — Fase 0: hardening previo al sistema de cuentas/social
-- Ejecutar en: Supabase → SQL Editor → New query
-- =====================================================================
--
-- Qué corrige esto:
--   1. `handle_new_user()` (trigger sobre auth.users que crea la fila en
--      `profiles`) es SECURITY DEFINER pero no tenía `search_path` fijo.
--      El advisor de seguridad de Supabase lo marca como
--      "Function Search Path Mutable": alguien con permiso de crear
--      objetos en un schema que aparezca antes que `public` en el
--      search_path del rol podría, en teoría, hacer que la función
--      resuelva `profiles` a una tabla trampa. Se soluciona fijando el
--      search_path igual que ya se hizo con `get_email_for_login` y
--      `check_comment_rate_limit`.
--   2. `profiles.username` ya tenía un UNIQUE index normal
--      (`profiles_username_key`), pero es case-sensitive: "Lucas" y
--      "lucas" pasarían como usernames distintos. Se reemplaza por un
--      índice único sobre `lower(username)` como defensa en profundidad
--      además del chequeo case-insensitive que ya hace el cliente.
--      Verificado antes de correr esto: no hay usernames existentes que
--      choquen solo por mayúsculas/minúsculas.

-- ── 1. search_path fijo en handle_new_user ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, avatar_url, username_confirmed)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    (new.raw_user_meta_data->>'username') is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ── 2. UNIQUE case-insensitive en username ──────────────────────────────
alter table public.profiles drop constraint if exists profiles_username_key;

create unique index profiles_username_lower_key
  on public.profiles (lower(username));

-- Los 3 chequeos client-side de "¿está disponible este username?"
-- (LoginModal, UsernameSetupModal, ProfileHeader) hacían un
-- `.eq('username', value)` case-sensitive contra `public_profiles`. Con el
-- índice de arriba ya activo, un usuario podía ver "¡Disponible!" para una
-- variante de mayúsculas de un username existente y después reventar con
-- un error crudo de Postgres al guardar. Esta RPC centraliza el chequeo
-- case-insensitive real; los 3 call sites se actualizan para usarla.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select not exists (
    select 1 from public.public_profiles where lower(username) = lower(p_username)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;


-- ── 3. CRÍTICO: restaurar public_profiles (estaba rota en producción) ──
-- Se encontró `public_profiles` con `security_invoker=on` en vivo — el
-- Security Advisor de Supabase sugiere ese fix para el warning
-- "Security Definer View" con un botón de un clic, sin saber que acá es
-- intencional (ver comentario original en supabase_security_hardening.sql,
-- sección 2). Con `security_invoker=on`, la vista deja de saltarse el RLS
-- de `profiles` ("cada quien lee solo su fila"), así que CUALQUIERA que no
-- sea el dueño de la fila —incluido un visitante anónimo— la ve vacía.
-- Efecto verificado en vivo: /u/:username → "Perfil no encontrado" para
-- perfiles que sí existen, autores de comentarios/seguidores rotos, y
-- `username_available()` devolviendo "disponible" para nombres ya usados.
-- Esto NO lo causó este script — ya estaba así antes de esta sesión.
-- El advisor va a seguir marcando esta vista como ERROR ("Security
-- Definer View") después de este fix — es esperado y aceptado a
-- propósito: la seguridad viene de qué columnas expone la vista (nunca
-- `email`, nunca `username_confirmed`), no de RLS por fila. NO aplicar
-- el fix de un clic del dashboard sobre esta vista.
alter view public.public_profiles set (security_invoker = off);
