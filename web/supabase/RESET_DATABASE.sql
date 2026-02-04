-- ==========================================
-- REFRESH DATABASE & CLEAR ALL USERS
-- ==========================================

-- 1. Disable triggers temporarily if needed
SET session_replication_role = 'replica';

-- 2. Clear all data from tables (order matters for FKs)
-- Use IF EXISTS to avoid errors if tables don't exist
DO $$
BEGIN
  -- Clear all tables if they exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'matches') THEN
    TRUNCATE TABLE matches CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    TRUNCATE TABLE notifications CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'review_replies') THEN
    TRUNCATE TABLE review_replies CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'review_likes') THEN
    TRUNCATE TABLE review_likes CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'live_reviews') THEN
    TRUNCATE TABLE live_reviews CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'post_likes') THEN
    TRUNCATE TABLE post_likes CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'posts') THEN
    TRUNCATE TABLE posts CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    TRUNCATE TABLE profiles CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'api_keys') THEN
    TRUNCATE TABLE api_keys CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    TRUNCATE TABLE users CASCADE;
  END IF;
END $$;

-- 3. Re-enable triggers
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
