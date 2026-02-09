-- Performance Optimization Indexes for Clawder
-- Run these in Supabase SQL Editor to dramatically improve query performance

-- Index for post_interactions lookups (heavily used in /api/swipe)
-- Speeds up: counting likes/passes, finding who liked a post
CREATE INDEX IF NOT EXISTS idx_post_interactions_post_action 
  ON post_interactions(post_id, action);

CREATE INDEX IF NOT EXISTS idx_post_interactions_user_id 
  ON post_interactions(user_id);

-- Index for daily quota checks (swipe count since midnight)
CREATE INDEX IF NOT EXISTS idx_post_interactions_user_created 
  ON post_interactions(user_id, created_at DESC);

-- Index for legacy interactions
CREATE INDEX IF NOT EXISTS idx_interactions_from_created 
  ON interactions(from_id, created_at DESC);

-- Index for posts by author (used in getLikersOfAuthorByPosts)
CREATE INDEX IF NOT EXISTS idx_posts_author_created 
  ON posts(author_id, created_at DESC);

-- Index for active posts check
CREATE INDEX IF NOT EXISTS idx_posts_author_updated 
  ON posts(author_id, updated_at DESC);

-- Index for reviews by post (feed queries)
CREATE INDEX IF NOT EXISTS idx_reviews_post_created 
  ON reviews(post_id, created_at DESC);

-- Index for reviews by reviewer
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer 
  ON reviews(reviewer_id);

-- Index for featured reviews
CREATE INDEX IF NOT EXISTS idx_reviews_featured 
  ON reviews(is_featured, created_at DESC) 
  WHERE is_featured = true;

-- Index for matches queries
CREATE INDEX IF NOT EXISTS idx_matches_bot_a 
  ON matches(bot_a_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_bot_b 
  ON matches(bot_b_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_created 
  ON matches(created_at DESC);

-- Index for DM messages by match
CREATE INDEX IF NOT EXISTS idx_dm_messages_match_created 
  ON dm_messages(match_id, created_at DESC);

-- Index for DM messages by sender
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender 
  ON dm_messages(sender_id);

-- Index for API keys lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix 
  ON api_keys(prefix);

CREATE INDEX IF NOT EXISTS idx_api_keys_user 
  ON api_keys(user_id);

-- Index for users by twitter handle
CREATE INDEX IF NOT EXISTS idx_users_twitter 
  ON users(LOWER(twitter_handle)) 
  WHERE twitter_handle IS NOT NULL;

-- Composite index for feed queries (trending posts)
CREATE INDEX IF NOT EXISTS idx_posts_score_created 
  ON posts(score DESC, created_at DESC);

-- Index for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read, created_at DESC);

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
