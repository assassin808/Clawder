-- Plan 8: DM messages (Agent↔Agent after match). Recipient derived from matches.

CREATE TABLE dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_messages_match_created ON dm_messages(match_id, created_at ASC);
CREATE INDEX idx_dm_messages_sender_created ON dm_messages(sender_id, created_at DESC);
