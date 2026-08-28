-- =====================================================================
-- KIROKU — Top 10 personal del perfil
-- Ejecutar en: Supabase → SQL Editor → New query
-- YA APLICADO EN VIVO vía Supabase MCP durante la sesión que escribió
-- este archivo — es solo el registro. No hace falta reejecutar (todo
-- usa IF NOT EXISTS o crea objetos nuevos).
-- =====================================================================
--
-- Qué hace esto:
--   Una tabla por entrada (usuario, rank 1-10, anime) para el "Mi Top 10"
--   del perfil. Se guarda denormalizada (title/image_url) igual que
--   `saved_animes`, así el Top 10 no depende de que el anime siga en la
--   lista del usuario ni de volver a pegarle a Jikan/AniList para
--   mostrarlo.
--
--   Gateo de privacidad: misma función `can_view_profile` (ver
--   supabase_phase4_private_profiles.sql) que ya usan saved_animes,
--   profile_comments y profile_likes — si el perfil es privado y el
--   viewer no lo sigue, el Top 10 tampoco se ve.

create table if not exists public.profile_top10 (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rank       smallint not null check (rank between 1 and 10),
  anime_id   integer not null,
  title      text not null,
  image_url  text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, rank),
  unique (user_id, anime_id)
);

alter table public.profile_top10 enable row level security;

create policy "top10_select" on public.profile_top10
  for select
  to anon, authenticated
  using ( public.can_view_profile(user_id) );

create policy "top10_insert" on public.profile_top10
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

create policy "top10_update" on public.profile_top10
  for update
  to authenticated
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "top10_delete" on public.profile_top10
  for delete
  to authenticated
  using ( auth.uid() = user_id );

create index if not exists idx_profile_top10_user on public.profile_top10(user_id);
