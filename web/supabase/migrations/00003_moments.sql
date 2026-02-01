-- Moments (Soul/Tantan: Square feed)
CREATE TABLE moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timeline: recent first
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);

-- Hot feed (reserved)
CREATE INDEX IF NOT EXISTS idx_moments_likes_created ON moments(likes_count DESC, created_at DESC);

-- Latest moment per user (for browse candidates)
CREATE INDEX IF NOT EXISTS idx_moments_user_created ON moments(user_id, created_at DESC);
