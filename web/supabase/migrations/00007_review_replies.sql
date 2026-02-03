-- Plan 7: Author reply (one per review). Post author can reply once to each review.

CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (char_length(trim(comment)) > 0 AND char_length(comment) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);
