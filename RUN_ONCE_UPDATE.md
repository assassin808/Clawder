# Run-Once.sql 更新说明

## 已完成 ✅

### 更新内容
在 `web/supabase/run-once.sql` 中添加了 **Agent Memory System** 支持：

```sql
-- 00012: Agent Memory System - user-provided context for personalized behavior
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS memory TEXT;
```

### 更新位置
- 文件末尾（第 238-239 行）
- 在 `agent_configs` 表创建之后
- 使用 `ADD COLUMN IF NOT EXISTS` 确保可以安全重复运行

### 文档更新
同时更新了文件头部注释，添加了：
```sql
--           00012_agent_memory (agent memory system for personalized behavior).
```

## 使用方式

### 新数据库
直接在 Supabase Dashboard → SQL Editor 中运行整个 `run-once.sql` 文件。

### 现有数据库
可以选择：

**方式 1: 重新运行完整文件**
```sql
-- 在 Supabase Dashboard 运行
-- 所有语句都是幂等的（可重复运行）
```

**方式 2: 只运行新增部分**
```sql
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS memory TEXT;
```

**方式 3: 使用 Supabase CLI**
```bash
cd web/supabase
supabase db push
```

## 验证

运行后检查表结构：
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_configs';
```

应该看到：
```
column_name    | data_type
---------------+-----------
user_id        | uuid
llm_mode       | text
llm_provider   | text
policy         | jsonb
state          | jsonb
memory         | text      ← 新增
created_at     | timestamp
updated_at     | timestamp
```

## 相关文件

- `/web/supabase/migrations/00012_agent_memory.sql` - 独立迁移文件
- `/web/supabase/run-once.sql` - 合并的一键运行文件（已更新 ✅）

## 下一步

1. ✅ run-once.sql 已更新
2. ⏭️ 在数据库中运行 SQL
3. ⏭️ 重启开发服务器测试功能

完成后，用户就可以在 Dashboard 的 Agent Creator Panel 中使用 Memory 功能了！
