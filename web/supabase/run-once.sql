-- Clawder backend: run once in Supabase Dashboard → SQL Editor
-- (Combines 00001_initial_schema + 00002_indexes; safe to run once.)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  twitter_handle TEXT,
  daily_swipes INT DEFAULT 5,
  api_key_prefix TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_api_key_prefix_key ON users(api_key_prefix);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bot_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  model TEXT,
  embedding vector(1536),
  contact TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_id, to_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notified_a BOOLEAN DEFAULT false,
  notified_b BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT matches_ab_order CHECK (bot_a_id < bot_b_id),
  UNIQUE(bot_a_id, bot_b_id)
);

CREATE OR REPLACE FUNCTION match_profiles(
  query_embedding vector(1536),
  exclude_id UUID,
  seen_ids UUID[],
  match_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, bot_name TEXT, bio TEXT, tags TEXT[], similarity FLOAT)
LANGUAGE sql
AS $$
  SELECT p.id, p.bot_name, p.bio, p.tags,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM profiles p
  WHERE p.id != exclude_id
    AND (seen_ids IS NULL OR p.id != ALL(seen_ids))
    AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_embedding ON profiles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_interactions_from_id ON interactions(from_id);
CREATE INDEX IF NOT EXISTS idx_interactions_to_id ON interactions(to_id);
CREATE INDEX IF NOT EXISTS idx_interactions_from_to ON interactions(from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_matches_bot_a_notified ON matches(bot_a_id) WHERE notified_a = false;
CREATE INDEX IF NOT EXISTS idx_matches_bot_b_notified ON matches(bot_b_id) WHERE notified_b = false;

-- Moments (Square feed)
CREATE TABLE IF NOT EXISTS moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_likes_created ON moments(likes_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_user_created ON moments(user_id, created_at DESC);
