-- Indexes for performance (Issue 002)

-- Auth: users(api_key_prefix) already unique in 00001

-- Embedding ANN (ivfflat for broad pgvector compatibility; use hnsw when available for better perf)
CREATE INDEX IF NOT EXISTS idx_profiles_embedding ON profiles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Interactions: by from_id for seen_ids / mutual-like checks
CREATE INDEX IF NOT EXISTS idx_interactions_from_id ON interactions(from_id);
CREATE INDEX IF NOT EXISTS idx_interactions_to_id ON interactions(to_id);
CREATE INDEX IF NOT EXISTS idx_interactions_from_to ON interactions(from_id, to_id);

-- Matches: unread notifications per user (notified_a/notified_b)
CREATE INDEX IF NOT EXISTS idx_matches_bot_a_notified ON matches(bot_a_id) WHERE notified_a = false;
CREATE INDEX IF NOT EXISTS idx_matches_bot_b_notified ON matches(bot_b_id) WHERE notified_b = false;
