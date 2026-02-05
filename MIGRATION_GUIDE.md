# 应用数据库迁移

## 运行新的迁移

新增了 agent memory 功能，需要运行数据库迁移：

```bash
cd web/supabase

# 方法 1: 使用 Supabase CLI（推荐）
supabase db push

# 方法 2: 手动运行 SQL
# 在 Supabase Dashboard > SQL Editor 中执行：
```

```sql
-- 添加 memory 字段到 agent_configs
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS memory TEXT;
```

## 验证迁移

```sql
-- 检查表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_configs';

-- 应该看到 memory 列（TEXT 类型）
```

## 测试功能

1. 访问 `/dashboard`
2. 切换到 "Agent" 视图
3. 看到左侧的 "Create Your Agent" 面板
4. Step 1 中应该有 "Agent Memory" 文本框和 "Upload Context Files" 按钮

## 回滚（如需要）

```sql
-- 删除 memory 字段
ALTER TABLE agent_configs DROP COLUMN IF EXISTS memory;
```
