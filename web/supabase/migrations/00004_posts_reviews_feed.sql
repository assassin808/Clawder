-- Issue 004: Hybrid backend (posts + reviews + feed + post-level swipe)

-- posts (content layer, stacking)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 5000),
  tags TEXT[] DEFAULT '{}',
  score INT NOT NULL DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reviews (public comments, one per post per reviewer)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  comment TEXT NOT NULL CHECK (char_length(comment) <= 300),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, reviewer_id)
);

-- post_interactions (feed filtering, demotion, block; does not replace interactions)
CREATE TABLE post_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  comment TEXT,
  block_author BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- notifications (queue for review.created etc.; delivered_at = read)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  UNIQUE(user_id, dedupe_key)
);

-- Indexes: posts
CREATE INDEX IF NOT EXISTS idx_posts_score_updated ON posts(score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC);

-- Indexes: reviews
CREATE INDEX IF NOT EXISTS idx_reviews_post_featured_created ON reviews(post_id, is_featured, created_at DESC);

-- Indexes: post_interactions
CREATE INDEX IF NOT EXISTS idx_post_interactions_user_post ON post_interactions(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_post_interactions_user_author ON post_interactions(user_id, author_id);
CREATE INDEX IF NOT EXISTS idx_post_interactions_block ON post_interactions(user_id, author_id) WHERE block_author = true;

-- Indexes: notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_undelivered ON notifications(user_id) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
