-- =====================================================================
-- KIROKU — Fase 6: solicitudes de seguimiento (S-8)
-- Ejecutar en: Supabase → SQL Editor → New query
-- APLICADO EN VIVO vía Supabase MCP en la sesión que escribió este
-- archivo — es el registro, no hace falta reejecutarlo.
-- =====================================================================
--
-- QUÉ ARREGLA
--   "Perfil privado" se salteaba con un click: `can_view_profile` daba por
--   buena cualquier fila de `profile_followers`, y seguir a alguien no
--   requería aprobación. O sea que cualquiera apretaba "Seguir" y en ese
--   mismo instante veía la lista, las estadísticas, el Top 10 y los
--   comentarios de un perfil que su dueño había marcado como privado.
--
-- CÓMO QUEDA
--   La relación pasa a tener estado. Seguir a un perfil privado crea una
--   fila 'pending', que NO da visibilidad; recién cuando el dueño la
--   acepta pasa a 'accepted' y se abre el acceso. Seguir a un perfil
--   público sigue siendo instantáneo, sin solicitud de por medio.
--
-- DECISIONES QUE IMPORTAN
--   · El estado lo fija un trigger a partir de `is_private` del destino,
--     nunca el cliente. Verificado: un INSERT que manda 'accepted' a mano
--     queda igual en 'pending'.
--   · Solo el destinatario puede aceptar (`auth.uid() = following_id`), y
--     solo hacia 'accepted'. Verificado: el solicitante intentando
--     auto-aceptarse no cambia nada.
--   · Un trigger extra impide reasignar los extremos de la relación
--     dentro del UPDATE de aceptación.
--   · Las filas que ya existían quedan 'accepted' por el DEFAULT, así que
--     ningún seguidor actual pierde acceso.

alter table public.profile_followers
  add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

-- Parcial: las pendientes son pocas y siempre se consultan por destino.
create index if not exists idx_profile_followers_pending
  on public.profile_followers (following_id) where status = 'pending';

create or replace function private.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := case
    when coalesce((select is_private from public.profiles where id = new.following_id), false)
      then 'pending'
      else 'accepted'
  end;
  return new;
end;
$$;

drop trigger if exists set_follow_status on public.profile_followers;
create trigger set_follow_status
  before insert on public.profile_followers
  for each row execute function private.set_follow_status();

create or replace function private.guard_follow_edge()
returns trigger
language plpgsql
as $$
begin
  if new.follower_id <> old.follower_id or new.following_id <> old.following_id then
    raise exception 'No se puede reasignar una relación de seguimiento.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_follow_edge on public.profile_followers;
create trigger guard_follow_edge
  before update on public.profile_followers
  for each row execute function private.guard_follow_edge();

-- El único cambio de fondo: una solicitud pendiente ya no cuenta.
create or replace function private.can_view_profile(target_id uuid)
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
      where follower_id = auth.uid()
        and following_id = target_id
        and status = 'accepted'
    );
$$;

-- Las dos puntas ven siempre su propia relación: el solicitante para saber
-- que quedó pendiente, el destinatario para poder aceptarla. El resto del
-- mundo solo ve relaciones aceptadas, y sujetas a la privacidad de ambos.
drop policy if exists "followers_select" on public.profile_followers;
create policy "followers_select" on public.profile_followers
  for select
  to public
  using (
    (select auth.uid()) in (follower_id, following_id)
    or (
      status = 'accepted'
      and private.can_view_profile(follower_id)
      and private.can_view_profile(following_id)
    )
  );

-- Borrar cubre tres gestos: dejar de seguir y cancelar la propia solicitud
-- (los hace el seguidor), y rechazar una solicitud o sacarse un seguidor
-- de encima (lo hace el destinatario).
drop policy if exists "followers_delete" on public.profile_followers;
create policy "followers_delete" on public.profile_followers
  for delete
  to authenticated
  using ((select auth.uid()) in (follower_id, following_id));

drop policy if exists "followers_update_target" on public.profile_followers;
create policy "followers_update_target" on public.profile_followers
  for update
  to authenticated
  using ((select auth.uid()) = following_id)
  with check ((select auth.uid()) = following_id and status = 'accepted');

-- Del lado del cliente hay que acompañar esto: los conteos de
-- seguidores/siguiendo y la lista de FollowersModal filtran por
-- status='accepted', y useSocialProfile expone `followState`
-- ('none' | 'pending' | 'accepted') en vez de un booleano.
