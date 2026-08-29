-- =====================================================================
-- KIROKU — Personajes favoritos del perfil
-- Ejecutar en: Supabase → SQL Editor → New query
-- =====================================================================
--
-- Qué hace esto:
--   Una fila por (usuario, personaje) favorito. Se guarda denormalizado
--   (name/image_url/anime_title) igual que `profile_top10`, así no depende
--   de volver a pegarle a la API para mostrar el perfil.
--
--   `character_id` es siempre un id de personaje de MyAnimeList. La sección
--   de personajes usa Jikan como fuente primaria y la API oficial de MAL
--   como respaldo, y ambas comparten ese espacio de ids (Jikan es un espejo
--   de MAL), así que no hace falta guardar de qué vía vino cada favorito.
--
--   Gateo de privacidad: misma función `can_view_profile` (ver
--   supabase_phase4_private_profiles.sql) que ya usan saved_animes,
--   profile_comments y profile_top10.

create table if not exists public.profile_favorite_characters (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  character_id integer not null,
  name         text not null,
  image_url    text not null,
  anime_id     integer not null,
  anime_title  text not null,
  created_at   timestamp with time zone default now(),
  unique (user_id, character_id)
);

alter table public.profile_favorite_characters enable row level security;

create policy "favorite_characters_select" on public.profile_favorite_characters
  for select
  to anon, authenticated
  using ( private.can_view_profile(user_id) );

create policy "favorite_characters_insert" on public.profile_favorite_characters
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

create policy "favorite_characters_update" on public.profile_favorite_characters
  for update
  to authenticated
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "favorite_characters_delete" on public.profile_favorite_characters
  for delete
  to authenticated
  using ( auth.uid() = user_id );

create index if not exists idx_profile_fav_chars_user on public.profile_favorite_characters(user_id);
