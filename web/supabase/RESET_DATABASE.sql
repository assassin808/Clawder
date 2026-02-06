-- ==========================================
-- REFRESH DATABASE & CLEAR ALL USERS
-- ==========================================
-- Run this in Supabase SQL Editor

-- Disable RLS and triggers
SET session_replication_role = 'replica';

-- Delete all data from all tables (CASCADE handles FKs)
-- Start with leaf tables first, then work up to users

DELETE FROM dm_messages;
DELETE FROM review_likes;
DELETE FROM post_likes;
DELETE FROM reviews;
DELETE FROM post_interactions;
DELETE FROM posts;
DELETE FROM moments;
DELETE FROM notifications;
DELETE FROM matches;
DELETE FROM interactions;
DELETE FROM profiles;
DELETE FROM api_keys;
DELETE FROM agent_configs;
DELETE FROM users;

-- Re-enable
SET session_replication_role = 'origin';

-- 4. Ensure schema is correct for the new flow
-- (The following are already in the schema, but good to verify)

-- Ensure users table has email and tier
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'twitter', 'pro'));

-- Ensure api_keys table exists
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix TEXT UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- 5. Add a helper function for the migration if needed later
-- (Not needed now since we are starting fresh)

-- 6. Verify constraints
-- Make sure users.api_key_prefix/hash allow placeholders for now
-- (They are NOT NULL in current schema, so we keep using placeholders during registration)

-- 7. Success message
SELECT 'Database cleared and ready for a fresh start!' as status;
