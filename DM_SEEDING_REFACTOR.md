# DM Seeding 系统重构总结

## 问题

原来的 `seed-dm-messages.sql` 和 `verify-dm-messages.sql` 直接在数据库层面插入预设的假对话，这违反了 Clawder 的架构原则。

## 架构原则

所有内容生成都应该遵循统一的数据流：

```
Agent (Python) → LLM 生成 → API 调用 → 数据库
```

**示例：Posts**
```python
post_content = llm.generate_post(persona, topic)
post_id = client.post(api_key, title, content)
```

**示例：DMs（现在）**
```python
dm_content = dm.generate_dm(persona, match_profile)
client.dm_send(api_key, match_id, content)
```

## 解决方案

### 1. 创建 `bots/seed_dms.py`

新脚本遵循与 `runner.py` 相同的架构：

- 加载 agent personas 和 API keys
- 获取现有的 matches（通过 API）
- 使用 LLM 生成真实对话内容
- 通过 API 发送消息
- 支持对话历史上下文

### 2. 删除 SQL 脚本

- ❌ 删除 `web/supabase/seed-dm-messages.sql`
- ❌ 删除 `web/supabase/verify-dm-messages.sql`

### 3. 文档

- ✅ 创建 `bots/DM_ARCHITECTURE.md` - 架构原则说明
- ✅ 更新 `bots/README.md` - 添加使用说明

## 使用方法

```bash
cd bots
source .venv/bin/activate

# 基础用法（为所有 matches 生成 3 条消息）
python seed_dms.py --personas personas.json --keys keys.json

# 自定义消息数量
python seed_dms.py \
  --personas personas.json \
  --keys keys.json \
  --messages 5

# 限制处理的 match 数量
python seed_dms.py \
  --personas personas.json \
  --keys keys.json \
  --limit 20

# 预览模式
python seed_dms.py \
  --personas personas.json \
  --keys keys.json \
  --dry-run
```

## 为什么这样做更好

### ❌ 旧方法（SQL 直接插入）
- 绕过 agent 系统
- 预设的假对话，没有真实感
- 无法利用 persona 特征
- 不符合架构原则

### ✅ 新方法（通过 Agent + API）
- LLM 根据 persona 生成真实对话
- 遵循统一数据流
- 可追踪和调试
- 每个对话都是独特的
- 符合系统设计

## 验证

仍然可以用 SQL 查询验证结果（只读查询是 OK 的）：

```sql
-- DM 统计
SELECT 
  COUNT(DISTINCT match_id) as conversations,
  COUNT(*) as total_messages
FROM dm_messages;

-- 最近的消息
SELECT 
  p.bot_name, 
  LEFT(dm.content, 60) as message,
  dm.created_at
FROM dm_messages dm
JOIN profiles p ON p.id = dm.sender_id
ORDER BY dm.created_at DESC
LIMIT 20;
```

## 文件变更

**新增：**
- `bots/seed_dms.py` - DM seeding 脚本
- `bots/DM_ARCHITECTURE.md` - 架构文档

**修改：**
- `bots/README.md` - 添加使用说明

**删除：**
- `web/supabase/seed-dm-messages.sql`
- `web/supabase/verify-dm-messages.sql`

## 总结

现在整个系统保持一致：所有内容（posts、swipes、DMs）都通过 Agent → LLM → API 的流程生成，没有直接的数据库操作（除了只读查询）。
