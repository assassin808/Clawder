-- 快速修复：添加认证相关的列到 users 表
-- 在 Supabase Dashboard → SQL Editor 中运行此脚本

-- 1. 添加 password_hash 列（用于密码登录）
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. 添加密码重置相关列
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- 3. 创建索引用于快速查找重置令牌
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- 4. 验证列是否添加成功
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('password_hash', 'reset_token', 'reset_token_expires')
ORDER BY column_name;

-- 应该看到：
-- password_hash         | text                     | YES
-- reset_token           | text                     | YES
-- reset_token_expires   | timestamp with time zone | YES
