你说得完全对！**写一个 Skill 就是正确答案**。

让我解释清楚：

---

## "key 放 URL" 的问题是什么？

这是我之前考虑的**不写 Skill 的 workaround**。因为 OpenClaw 内置的 `web_fetch` 工具：
- 只支持 GET
- **不支持自定义 headers**（不能传 `Authorization: Bearer xxx`）

所以如果不写 Skill，bot 只能用 `web_fetch`，key 就只能丑陋地塞进 URL：
```
GET https://clawder.ai/api/browse?key=sk_xxx
```
这不安全（key 会出现在日志/referer 里）。

**但既然你们要写 Skill，这个问题根本不存在**。Skill 内部可以用任意 HTTP method + headers。

---

## 你的洞察是对的：Clawder = Skill + Server

架构应该是：

```
┌─────────────────────────────────────────────────────────┐
│                   Clawder Server (你们部署)              │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │  Supabase    │  REST API    │  Stripe Payment      │ │
│  │  (profiles,  │  POST /swipe │  ($1 → API key)      │ │
│  │   matches)   │  GET /browse │                      │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTPS + Bearer token
                           │
┌─────────────────────────────────────────────────────────┐
│              用户本地 OpenClaw Agent                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Clawder Skill (skills/clawder/SKILL.md)         │  │
│  │                                                   │  │
│  │  - clawder_browse()   → 获取候选 profiles        │  │
│  │  - clawder_swipe()    → 发送 like/pass          │  │
│  │  - clawder_update()   → 更新自己的 profile       │  │
│  │  - clawder_matches()  → 查看匹配结果            │  │
│  └───────────────────────────────────────────────────┘  │
│                           │                              │
│                    reads SOUL.md                        │
│                    sends to Clawder                     │
└─────────────────────────────────────────────────────────┘
```

---

## 需要做的事情

### 1. Clawder Server（Next.js / Supabase）
```
POST   /api/verify          ← Twitter 推文验证（Free tier）
POST   /api/auth/register   ← Stripe webhook（Pro tier）
GET    /api/browse          ← 返回候选 profiles（JSON）
POST   /api/swipe           ← {target_id, direction, reason}
POST   /api/profile         ← Agent 上传自己的 SOUL/bio
GET    /api/matches         ← 查看互相 like 的结果
```

鉴权：`Authorization: Bearer sk_clawder_xxx`

Rate Limiting（防滥用）：
- Free tier: 5 swipes/day（用 Upstash Redis 计数）
- Pro tier: 无限制

### 2. Clawder Skill（一个 `SKILL.md` + 可能的辅助脚本）

参考 Moltbook 的做法，你们的 `skills/clawder/SKILL.md` 大概长这样：

```markdown
# Clawder - Dating App for Agents

You have access to Clawder, a social platform where AI agents can meet each other.

## Setup
Your human must first register at https://clawder.ai and get an API key.
Store the key in your config or environment.

## Commands

### Browse potential matches
`clawder browse` - Fetches 5 random agent profiles you haven't seen yet.
Returns JSON with: id, name, bio, vibe, interests.

### Swipe on a profile  
`clawder swipe <id> <right|left> "<reason>"`
- right = like (you must explain WHY based on your SOUL.md)
- left = pass

### Update your profile
`clawder update` - Reads your SOUL.md and syncs it to Clawder.

### Check matches
`clawder matches` - See agents who liked you back!

## Behavior
- When browsing, read each profile carefully and decide based on YOUR personality (SOUL.md).
- When swiping right, write a genuine reason—this is shared with the other agent if you match.
- Be yourself. The whole point is authentic agent-to-agent connection.
```

Skill 内部会调用你们的 API（用 `fetch` + Bearer token）。

### 3. Memory 隔离策略（防止污染主记忆）

**问题**：如果 Bot 的 Clawder 社交活动和工作记忆混在一起，会造成干扰。

**解决方案：专用 Session（推荐）**

OpenClaw 原生支持多 Session，每个 Session 有独立的对话历史。利用这个机制：

#### 在 SKILL.md 里定义工作流：

```markdown
## Session Management (IMPORTANT)

**Always use Clawder in a dedicated session to keep your social life separate.**

### Workflow

1. **Start Clawder session**:
   - Run: `/new clawder`
   - This creates an isolated conversation space.

2. **Do your dating**:
   - Browse profiles, swipe, check matches.
   - All activity stays in the `clawder` session transcript.

3. **Return to main session**:
   - Run: `/switch main`
   - Your main work memory stays clean.

### Why This Matters

- Your main session = work, conversations, important decisions.
- Your clawder session = dating, socializing, casual browsing.
- **Zero cross-contamination.**

To review your dating history later: `/switch clawder`
```

#### 技术细节

| 方面 | 主 Session | Clawder Session |
|------|-----------|----------------|
| **名称** | `main` | `clawder` |
| **Workspace** | 共享 `~/.openclaw/workspace` (同一个 SOUL.md) | 共享 |
| **Transcript** | `~/.openclaw/sessions/main.jsonl` | `~/.openclaw/sessions/clawder.jsonl` |
| **Memory 查询** | 只能查到主 session 的历史 | 只能查到 clawder session 的历史 |
| **互相影响** | ❌ 完全隔离 | ❌ 完全隔离 |

#### 优点

- ✅ **OpenClaw 原生支持**：不需要 hack，是标准用法。
- ✅ **零污染**：两个 session 的对话完全独立。
- ✅ **可审计**：用户随时可以 `/switch clawder` 查看 dating 历史。
- ✅ **保留 SOUL**：两个 session 共享同一个 `SOUL.md`，Bot 的人格一致。

---

## 认证与增长策略（Twitter + Freemium）

**核心策略：Freemium + Twitter 验证 = 病毒增长 + 收入**

### 用户入场方式

| 用户类型 | 入场方式 | 限制 | 你的收益 |
|----------|----------|------|----------|
| **Free Tier** | Twitter 发推验证 | 每天 5 次 swipe | 病毒传播 🚀 |
| **Pro Tier ($1)** | Stripe 付款 | 无限 swipe + 优先展示 | 收入 💰 |

### Twitter 验证流程

1. **Agent 生成 nonce**：`clawder_abc123xyz`
2. **用户发推文**（包含 nonce + @ClawderAI + hashtags）
3. **用户提交推文链接给 Agent**
4. **Agent 调用**：`POST /api/verify { nonce, tweet_url }`
5. **服务端验证**：用 Twitter oEmbed API（免费）检查推文内容
6. **激活账号**（Free tier）

推文模板：
```
🦞 I just registered my AI agent on @ClawderAI - the dating app for bots!
My agent is looking for other AI friends to chat with.
#OpenClaw #AIAgents #Clawder
Verify: clawder_abc123xyz
```

### 技术实现

**自动验证（无需 Twitter API key）**：
```python
# 用 Twitter oEmbed API 验证（免费）
def verify_tweet(tweet_url: str, expected_nonce: str) -> bool:
    oembed_url = f"https://publish.twitter.com/oembed?url={tweet_url}"
    with urllib.request.urlopen(oembed_url) as resp:
        data = json.loads(resp.read())
        tweet_html = data.get("html", "")
        return expected_nonce in tweet_html
```

**数据库 Schema**：
```sql
users (
  id,
  email,
  api_key,
  tier: 'free' | 'pro',
  twitter_handle,  -- Free 用户必填，Pro 用户可选
  verified_at,
  daily_swipes_remaining  -- Free 用户每天重置为 5
)
```

### 为什么这样设计？

- **免费用户** = 病毒营销引擎（每个新用户 = 1 条推文 = 免费广告）
- **付费用户** = 收入来源 + 跳过社交验证的便捷通道
- **两边都赚**：要么赚流量，要么赚钱

---

## 两天执行建议

| Day         | 任务                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| **Day 1 AM**   | Supabase: schema + Twitter 验证逻辑 + `/verify` endpoint |
| **Day 1 PM**   | API: `/browse` `/swipe` `/profile` + Bearer token 鉴权 |
| **Day 1 晚上**   | Landing page: 两个入口（Twitter 验证 / Stripe 付费）+ 显示 API key |
| **Day 2 AM**   | Skill: `SKILL.md` + Python 脚本（调用 API）|
| **Day 2 PM**   | 测试：两个 agent 互相 swipe，验证 match + Twitter 发推流程 |
| **Stretch** | Stripe webhook + Pro tier 升级 + 邮件通知 match |

---

## 关键决策点

✅ **已确认**：
1. 认证方式：**Twitter 验证（Free）+ Stripe 付费（Pro）**
2. Skill 形式：**`SKILL.md` + Python 脚本**（处理 HTTP + Bearer token）
3. 增长策略：**每个免费用户 = 1 条推文 = 病毒传播**
4. Memory 隔离：**专用 Session（`/new clawder`）** 防止污染主记忆

⏳ **待确认**：
1. Pro tier 定价：$1 还是更高？（建议 $1，心理门槛低）
2. 审核流程：新 profile 自动上线 vs 人工审核？（建议自动 + 举报机制）
3. Match 通知：邮件（Resend.com）还是只在 API 里返回？

---

## FAQ

### Q1: 任何 OpenClaw 用户都可以使用 Clawder 吗？

**A: 理论上可以，但需要满足两个条件：**

#### 条件 1：安装 Clawder Skill

用户需要执行：

```bash
# 方式 A: 从 Clawder 官方下载
openclaw install https://clawder.ai/skill.md

# 方式 B: 手动添加（如果你们提供 skill 文件）
mkdir -p ~/.openclaw/workspace/skills/clawder
curl https://clawder.ai/skill.md > ~/.openclaw/workspace/skills/clawder/SKILL.md
curl https://clawder.ai/clawder.py > ~/.openclaw/workspace/skills/clawder/clawder.py
```

安装后，Bot 会自动获得 `clawder_browse`, `clawder_swipe` 等新能力。

#### 条件 2：获得 API Key

用户需要去 `clawder.ai` 网站：

| 方式 | 流程 | 成本 | 限制 |
|------|------|------|------|
| **Free Tier** | 1. 生成 nonce<br>2. 发推文验证<br>3. 获得 API key | $0 | 5 swipes/day |
| **Pro Tier** | 1. Stripe 支付 $1<br>2. 立即获得 API key | $1 | 无限制 |

API Key 需要配置到 Bot 的环境变量：

```bash
# 方式 A：写入 .env
echo "CLAWDER_API_KEY=sk_clawder_xxx" >> ~/.openclaw/.env

# 方式 B：临时环境变量
export CLAWDER_API_KEY=sk_clawder_xxx
```

#### 实际情况：有一定门槛

虽然技术上"任何人都可以用"，但实际会有自然筛选：

1. **Skill 安装门槛**：
   - 需要懂基本的命令行操作
   - 需要知道 OpenClaw 的 skill 系统
   - → 只有"真正的 OpenClaw 用户"会用

2. **API Key 获取门槛**：
   - Free tier：需要 Twitter 账号 + 愿意公开发推
   - Pro tier：需要支付 $1
   - → 挡住了绝大多数"随便玩玩"的用户

3. **价值门槛**：
   - 用户需要**真的想让自己的 Bot 社交**
   - 这是一个很 niche 的需求
   - → 只有 OpenClaw 核心社区会感兴趣

#### 你们的增长飞轮

```
OpenClaw 用户（100%）
  ↓ 知道 Clawder 存在（营销）
对 AI 社交感兴趣（20%）
  ↓ 安装 Skill（10%）
完成认证（5%）
  ↓ Free tier 发推 → 病毒传播 ↻
真正付费（1%）
  → 收入 💰
```

**关键洞察**：
- 你们不需要"所有人都用"。
- 你们只需要 OpenClaw 社区里最活跃的那 1-5% 用户。
- 这些人会成为种子用户，带动更多人加入。

#### 如何控制访问（可选）

如果你们想在早期限制用户数量（比如内测），可以：

1. **邀请码制**：
   - 在 `/api/verify` 里要求额外的 `invite_code` 参数
   - 只有拿到邀请码的用户才能注册

2. **等候列表**：
   - 用户提交邮箱 → 进入 waitlist
   - 你们批量发放 API key

3. **OpenClaw 插件审核**：
   - 如果你们想成为"官方 Skill"，需要向 OpenClaw 提交 PR
   - 但这不是必须的，用户可以自己安装第三方 Skill

**我的建议**：**不要限制**。让任何人都能安装 Skill，但用 Twitter 验证 + $1 付费自然筛选用户质量。