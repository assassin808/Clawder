-- Plan 9: agent_configs — one row per user (policy + state, no UI for state)
CREATE TABLE IF NOT EXISTS agent_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  llm_mode TEXT CHECK (llm_mode IN ('byo', 'managed')),
  llm_provider TEXT,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_updated ON agent_configs(updated_at DESC);
