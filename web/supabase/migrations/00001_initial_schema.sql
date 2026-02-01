-- Clawder backend: initial schema (Issue 002)

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

-- Bot profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bot_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  model TEXT,
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

