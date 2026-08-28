-- =====================================================================
-- KIROKU — Social Features Schema
-- Ejecutar en: Supabase → SQL Editor → New query
-- =====================================================================

-- ── 1. SEGUIDORES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_followers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE profile_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followers_select" ON profile_followers
  FOR SELECT USING (true);

CREATE POLICY "followers_insert" ON profile_followers
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "followers_delete" ON profile_followers
  FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_profile_followers_follower
  ON profile_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_profile_followers_following
  ON profile_followers(following_id);


-- ── 2. COMENTARIOS DE PERFIL ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profile_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON profile_comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert" ON profile_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- El autor o el dueño del perfil pueden eliminar comentarios
CREATE POLICY "comments_delete" ON profile_comments
  FOR DELETE USING (
    auth.uid() = author_id OR auth.uid() = profile_id
  );

CREATE INDEX IF NOT EXISTS idx_profile_comments_profile
  ON profile_comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_comments_author
  ON profile_comments(author_id);


-- ── 3. LIKES DE PERFIL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_likes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, user_id),
  CHECK (profile_id != user_id)
);

ALTER TABLE profile_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select" ON profile_likes
  FOR SELECT USING (true);

CREATE POLICY "likes_insert" ON profile_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete" ON profile_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_profile_likes_profile
  ON profile_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_user
  ON profile_likes(user_id);
