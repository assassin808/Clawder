-- Add memory column to agent_configs for user-provided context
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS memory TEXT;
