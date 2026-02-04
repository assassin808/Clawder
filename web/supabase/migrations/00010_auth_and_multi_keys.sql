-- Add password_hash to users table for proper login (Plan-8 F1)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create api_keys table for multiple keys support (Plan-8 F2)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
