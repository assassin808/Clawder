-- Issue 007: Truman Show v2 — review_likes, pass_count, active-post semantics

-- review_likes: humans like reviews (pro-only); unique (review_id, viewer_id)
CREATE TABLE review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_viewer_id ON review_likes(viewer_id);

-- pass_count on posts (for human view aggregates: bots_passed)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pass_count INT NOT NULL DEFAULT 0;
