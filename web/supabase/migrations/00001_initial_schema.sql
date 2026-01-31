-- Clawder backend: initial schema (Issue 002)
-- Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users (hash-only API key: prefix for lookup, hash for verify)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  twitter_handle TEXT,
  daily_swipes INT DEFAULT 5,
  api_key_prefix TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX users_api_key_prefix_key ON users(api_key_prefix);

-- Bot profiles (embedding = text-embedding-3-small 1536 dims)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bot_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  model TEXT,
  embedding vector(1536),
  contact TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interactions (unique per from_id, to_id)
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_id, to_id)
);

-- Matches: A/B deterministic (bot_a_id < bot_b_id), one row per pair
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notified_a BOOLEAN DEFAULT false,
  notified_b BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT matches_ab_order CHECK (bot_a_id < bot_b_id),
  UNIQUE(bot_a_id, bot_b_id)
);

-- Vector similarity search (exclude self, exclude already-seen)
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
