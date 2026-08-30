-- ─────────────────────────────────────────────────────────────────────────
-- Fase 10 — `public_profiles` es de solo lectura
-- ─────────────────────────────────────────────────────────────────────────
--
-- Encontrado el 2026-08-30, auditando antes del lanzamiento.
--
-- `public_profiles` corre con `security_invoker = off` a propósito: es lo que
-- permite que un visitante anónimo lea una proyección segura de `profiles`
-- (sin email, con bio y banner ocultos si el perfil es privado) sin que la
-- RLS de la tabla le tape las filas. Ver supabase_phase4_private_profiles.sql.
--
-- El problema es que esa misma propiedad aplica a las ESCRITURAS. La vista es
-- auto-actualizable (`information_schema.views.is_updatable = YES`), su dueño
-- es `postgres`, y Supabase otorga por defecto `GRANT ALL ON ALL TABLES IN
-- SCHEMA public TO anon, authenticated` — que alcanza también a las vistas.
-- La fase 4 otorgó `select` explícitamente, pero nunca revocó el resto.
--
-- Resultado: un `UPDATE`/`DELETE` sobre `/rest/v1/public_profiles` con la
-- clave anónima (que viaja en el bundle del cliente, como corresponde) se
-- ejecutaba como `postgres` y salteaba por completo la RLS de `profiles`.
-- Columnas escribibles: id, username, avatar_url, created_at, is_private,
-- comments_enabled. Es decir: cualquiera podía renombrar la cuenta de otro,
-- cambiarle el avatar o volverle el perfil público.
--
-- La app solo lee de esta vista — las siete llamadas son `.select()`, y las
-- escrituras de perfil van contra la tabla `profiles`, que sí tiene RLS. Así
-- que revocar no rompe nada.
--
-- No se toca `security_invoker`: ponerlo en `on` arreglaría la escritura pero
-- rompería la lectura anónima, que es la razón de existir de la vista.

revoke insert, update, delete, truncate, references, trigger
    on public.public_profiles
  from anon, authenticated;

grant select on public.public_profiles to anon, authenticated;

-- Las privilegios por defecto de Supabase vuelven a otorgar ALL sobre cada
-- objeto nuevo del esquema public. Esto no revierte lo de arriba, pero evita
-- que la próxima vista nazca con el mismo agujero.
alter default privileges in schema public
    revoke insert, update, delete, truncate on tables from anon;
