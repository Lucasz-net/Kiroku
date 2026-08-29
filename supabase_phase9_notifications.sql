-- =====================================================================
-- KIROKU — Notificaciones, tope de personajes y RLS (fases 9 y 10)
-- APLICADO EN VIVO vía Supabase MCP. Es el registro, no hace falta
-- reejecutarlo.
-- =====================================================================
--
-- NOTIFICACIONES (F-4 + F-8)
--
--   Se DERIVAN de las tablas existentes en vez de materializarse en una
--   tabla propia. La decisión sale directo del requisito: al dejar de
--   seguir a alguien, sus notificaciones tienen que desaparecer. Con
--   filas materializadas eso obliga a un borrado en cascada por cada
--   unfollow (y a acordarse de mantenerlo para siempre); derivándolas, el
--   join con profile_followers deja de coincidir y desaparecen solas.
--
--   Verificado: con Admin siguiendo a Luxioz, get_notifications devuelve
--   su actividad; borrando la fila de follow dentro de una transacción, el
--   conteo de notificaciones de Luxioz pasa a 0 en el acto.
--
--   Dos orígenes en un mismo feed:
--     · lo que te pasó a vos       → seguidores, solicitudes, comentarios
--     · lo que hicieron los que seguís → animes, Top 10, personajes
--
--   `notifications_seen_at` es una sola marca por usuario en lugar de
--   estado de leído por notificación: alcanza para el contador de la
--   campanita y no deja estado huérfano cuando una notificación deja de
--   existir.
--
--   Es SECURITY DEFINER porque cruza datos de varios usuarios; por eso
--   todo está anclado a auth.uid() y ninguna función recibe un id por
--   parámetro.
--
-- El cuerpo exacto de get_notifications y count_unread_notifications está
-- en la migración `phase9_notifications` del historial de Supabase.

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz not null default now();

grant update (notifications_seen_at) on public.profiles to authenticated;


-- ── Tope de personajes favoritos (F-11) ──────────────────────────────
-- Sin límite, el perfil público se vuelve una pared infinita de imágenes
-- y cada visita las descarga todas. Doce entra prolijo en la grilla y
-- obliga a elegir, que es de lo que se trata un "favoritos". Va en un
-- trigger porque el chequeo del cliente se saltea con un POST directo.
create or replace function private.check_favorite_characters_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.profile_favorite_characters
    where user_id = new.user_id
  ) >= 12 then
    raise exception 'Llegaste al máximo de 12 personajes favoritos. Quitá uno para agregar otro.';
  end if;
  return new;
end;
$$;

drop trigger if exists favorite_characters_limit on public.profile_favorite_characters;
create trigger favorite_characters_limit
  before insert on public.profile_favorite_characters
  for each row execute function private.check_favorite_characters_limit();


-- ── Rendimiento: RLS sin reevaluar auth.uid() por fila (P-4) ─────────
-- El advisor marcaba 14 policies que llamaban a auth.uid() directamente,
-- lo que hace que Postgres la reevalúe una vez por fila. Envueltas en
-- (select ...) se evalúa una sola vez por consulta. Después de esto el
-- advisor de rendimiento quedó sin avisos. Ver la migración
-- `phase8_rls_initplan` para el listado completo.
