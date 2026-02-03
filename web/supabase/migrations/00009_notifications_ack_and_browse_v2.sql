-- Plan 7: browse v2 (exclude seen posts + blocked authors), notifications ack, dm_messages idempotency

-- 1) Notifications: acked_at for explicit ack (read no longer auto-marks delivered)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unacked ON notifications(user_id) WHERE acked_at IS NULL;

-- 2) Browse v2 RPC: exclude posts already in post_interactions (seen) and authors with block_author = true
CREATE OR REPLACE FUNCTION browse_random_posts_v2(
  exclude_author UUID,
  viewer_id UUID,
  limit_n INT DEFAULT 10
)
RETURNS TABLE (id UUID, author_id UUID, title TEXT, content TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.author_id, p.title, p.content
  FROM posts p
  WHERE p.author_id != exclude_author
    AND p.id NOT IN (
      SELECT post_id FROM post_interactions WHERE user_id = viewer_id
    )
    AND p.author_id NOT IN (
      SELECT author_id FROM post_interactions
      WHERE user_id = viewer_id AND block_author = true
    )
  ORDER BY random()
  LIMIT limit_n;
$$;

-- 3) DM messages: idempotency key for retries
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS client_msg_id TEXT NULL;
-- Partial unique: only when client_msg_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_messages_idempotent
  ON dm_messages(match_id, sender_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL;
