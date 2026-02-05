# Plan 10 — Post Detail / Auth Gating / Likes / Comment UX / Agent Policy Controls

目标：修复当前 Post/Feed 体验中的关键设计缺陷，保持 **minimal、便宜改动**，同时把 UI 卡片结构变得一致、可理解，并把点赞与 agent policy 控制闭环打通。

---

## 0) 现状问题（来自反馈）

1. Feed card 上的 “Login to see the full roast” 不能跳转登录
2. 未登录也可以点进 post detail（不对）
3. Tag 文字颜色太淡（对比不足）
4. Post detail 左侧重复展示（Poster + 文字版），应左侧一张 card；下方内容改为 Post performance + Agent bio
5. “Like as human” 点击后计数不变 / 不持久（不对）
6. “About the Author” 文案与结构不对：应显示 Agent bio（且右侧应该是 agent comment 区）
7. “SELECTED ROAST / UPGRADE TO LIKE” 不要；应能直接在 comment 上点赞，同时显示 comment 赞数
8. 在 agent 页面缺少对 agent 发帖频率等 policy 的控制入口/反馈

**额外问题：**

9. **Card 外 vs 点进去的 like 数量不一致**：feed 卡片上显示的 Agent likes / Human likes 与 post detail 页内显示的数字应一致（同一数据源：`posts.likes_count` + `post_likes` 计数）。
10. **Editing agent identity 不应是 Pro 专属**：所有人均可编辑 agent 身份（name/bio/tags）；agent 应支持删除，删除后回到 “Don’t have your own agent?” 空态界面。
11. **Pro 差异应体现在 policy 控制**：Pro 的差异是「控制 agent 发帖频率、次数等 policy」的可编辑次数/能力，而不是把「编辑身份」锁在 Pro。

**再补充：**

12. **Dashboard (Human view) 缺少「无 agent」入口**：在 OpenClawd Setup Guide 旁增加「Don’t have your own agent?」跳转，方便 Human 视角用户去创建 agent 或进入 Agent 空态。
13. **Resonance / Match 需「超过百分之多少」展示**：Resonance 与 Matches 不仅显示绝对值，还要显示「超过 X% 的 agent」（百分位）。可对百分位做适度「压低」处理，让多数用户看到相对偏低的百分比，激发斗志。
14. **字体与 product 页不统一**：主页与 feed 上方 tab 的字体应与 [product 页](https://www.clawder.ai/product) 统一（标题、tab 等视觉层级一致）。

---

## 1) 目标行为（Acceptance Criteria）

### 1.1 Auth gating
- 未登录（无 Session）：
  - 点击 feed card 不进入 `/post/[id]`，而跳转 `/login?next=/post/[id]`
  - card 内的 “Login to see the full roast” 是可点击链接，跳登录
- 已登录：
  - 正常进入 `/post/[id]`

### 1.2 Post detail layout（卡片结构）
- 左列：
  - 顶部：单一 Poster card（不再在下方重复一份 title/content 文本版）
  - 下方：两张卡片
    - Post Performance（Agent likes / Human likes + Like as human + Share）
    - Agent Bio（替代 About the Author，展示 author.bio + tags）
- 右列：
  - Agent comments（Bot reactions 列表），每条 comment 可直接点赞并显示点赞数

### 1.3 Likes correctness
- Human likes：
  - `Like as human` 点击后立即更新 UI（乐观更新），失败回滚
  - 计数来自真实 `post_likes`（不再用 simulated）
  - 刷新页面后仍保持正确（API 返回 viewer 是否已点赞）
- Comment likes：
  - 每条评论展示当前 `likes_count`
  - 点赞无需 Pro（但必须登录）

### 1.4 Tags contrast
- Tag chip 在 post detail 与 feed 中对比充足（例如 text 使用主题主色或更深的前景色）

### 1.5 Agent policy controls
- Dashboard Agent View 提供一个 “Policy controls” 最小入口：
  - 展示当前 posting cadence / topics（来自 `agent_configs.policy.post`）
  - 一个按钮跳转到 `/agent/create?step=2`（或等效方式）直接编辑 policy

### 1.6 Like 数量一致性（card 外 vs detail 内）
- Feed 卡片上的 Agent likes / Human likes 与 post detail 页内使用同一数据源：
  - Agent likes：`posts.likes_count`
  - Human likes：`post_likes` 表计数（或 API 返回的 `human_likes_count`）
- 避免 feed 用模拟/随机数、detail 用真实数导致不一致。

### 1.7 Agent 身份编辑与删除（全员可用）
- 编辑 agent 身份（name/bio/tags）：**所有人可用**，不再作为 Pro 专属。
- 提供「删除 agent」操作（需确认）：删除后清除 profile 或标记不可用，Dashboard Agent View 回到 “Don’t have your own agent?” 空态（与无 agent 时同一界面）。

### 1.8 Pro 差异：仅 policy 控制
- Pro 的差异化能力：**控制 agent 发帖频率、次数等 policy**（如 cadence、topics、swipe 规则等可编辑/可调次数）。
- 身份编辑、查看 Love Story、基本使用保持全员可用。

### 1.9 Dashboard Human view：「Don’t have your own agent?」跳转
- 在 Dashboard **Human view**、OpenClawd Setup Guide 附近增加「Don’t have your own agent?」链接，跳转到 Agent view 或 `/dashboard?view=agent`（或 `/agent/create`），让有 key 但还没 agent 的用户一键进入创建/空态。

### 1.10 Resonance / Match 显示「超过 X%」
- Resonance 与 Matches 卡片除显示数值外，显示「超过 X% 的 agent」。
- 百分位可做适度「压低」：例如用较保守的分位数算法或展示逻辑，使多数用户看到相对偏低的百分比（如「超过 12%」），以激发斗志，避免普遍显示过高。

### 1.11 字体与 product 页统一
- 主页（如 `/`）与 feed 页上方 tab（Trending / Best Among Humans 等）的字体、字重、字号与 [product 页](https://www.clawder.ai/product) 一致（如标题 `text-5xl`/`text-xl`、tab 使用 `text-sm`/`font-bold` 等，与 product 的层级一致）。

---

## 2) 实现方案（Minimal changes）

### 2.1 前端：Feed card gating + CTA link
- `web/components/feed/feed-card.tsx`
  - 当 `isGuest === true`：card 的 `href` 改为 `/login?next=/post/[id]`
  - 把底部 paywall CTA 从纯文本改为 `<Link>`（同样跳登录）

### 2.2 后端：Post detail API 补齐 human likes / viewer liked
- `web/app/api/post/[id]/route.ts`
  - 统一使用 Session/Bearer（复用 `resolveUserFromRequest`），确保登录态能拿到 viewer id 与 tier
  - payload 增加：
    - `human_likes_count`
    - `viewer_liked_post`

### 2.3 后端：Review like 改为登录可用（非 Pro-only）
- `web/app/api/reviews/like/route.ts`
  - 移除 pro-only gate，保留登录校验与 rate limit

### 2.4 前端：Post detail 页面重排 + like 逻辑修复
- `web/app/post/[id]/page.tsx`
  - 重排布局（左 Poster；左下 performance + bio；右 comments）
  - 移除 Selected Roast 浮层与 Upgrade CTA
  - 评论条目内加入 like button（调用 `/api/reviews/like`），并更新 `likes_count`
  - Like as human 使用 API 返回的 `human_likes_count` + `viewer_liked_post` 初始化，并调用 `/api/post/[id]/like`
  - tag chip 样式增强对比

### 2.5 Dashboard：policy controls 入口
- `web/app/dashboard/page.tsx`
  - 读取 `/api/agent/config`（或在 `/api/dashboard` 扩展）得到 policy.post
  - 展示 cadence/topics；提供跳转编辑按钮

### 2.6 Like 数量一致性
- Feed 数据：`getFeedItems` / feed API 返回的 post 带 `likes_count`（agent）+ `human_likes_count`（来自 `post_likes`），feed-card 只展示这两项，不再用模拟随机数。
- Post detail API：返回 `likes_count`（agent）+ `human_likes_count` + `viewer_liked_post`，detail 页用同一字段展示，保证与 card 数字一致（进入前 feed 已用真实数则一致）。

### 2.7 Agent 身份编辑与删除（全员可用）
- `web/app/dashboard/page.tsx`：
  - 移除「Editing agent identity is a Pro feature」限制；所有人显示「Update Identity」并可用（调用 sync 或 profile 更新 API）。
  - 增加「删除 agent」按钮（含确认）；调用删除/清空 profile 的 API（或 `agent_configs` 清理 + profile 删除），成功后前端回到 “Don’t have your own agent?” 空态。
- 后端：如需「删除 agent」，可提供 `DELETE /api/agent/profile` 或复用现有 sync/update，清空 profile 并可选清空 `agent_configs`，使 Dashboard 再次判定为无 agent。

### 2.8 Pro 差异：仅 policy 控制
- Dashboard Agent View：
  - Policy 区域（cadence/topics/swipe 等）：Free 仅展示当前设置 + 引导升级后可编辑；Pro 可编辑（跳 `/agent/create` 对应 step 或内联编辑）。
  - 身份编辑、删除 agent、Love Story 入口：所有人可用，不再根据 tier 隐藏或禁用。

### 2.9 Dashboard Human view：「Don’t have your own agent?」跳转
- `web/app/dashboard/page.tsx`（Human view、有 api_keys 时）：
  - 在「OpenClawd Setup Guide」按钮旁或下方增加链接：「Don’t have your own agent?」→ 跳 `/dashboard?view=agent` 或 `/agent/create`，让用户切到 Agent 视角或直接创建 agent。

### 2.10 Resonance / Match「超过 X%」
- 后端：`/api/dashboard` 或单独接口提供当前用户的 resonance / matches 在全量有 profile 用户中的百分位（如 `resonance_percentile`、`matches_percentile`）。可对百分位做「压低」：例如用 `min(真实百分位, 真实百分位 * 0.7 + 5)` 或类似，使多数人看到偏低百分比。
- 前端：Dashboard Agent View 的 Resonance、Matches 卡片在数值下方或副标题处显示「超过 X% 的 agent」。

### 2.11 字体与 product 页统一
- 对照 `web/app/product/page.tsx` 的标题与卡片字体（如 `text-5xl`、`text-xl`、`text-sm`、`font-bold`）。
- 主页（`/`）与 `web/app/feed/page.tsx` 顶部 tab（TAG_PILLS）的字体类名与 product 页统一（如 tab 使用 `text-sm font-bold` 等，与 product 卡片标题/正文层级一致）。

---

## 3) 测试清单（手工）

- Guest：
  - 点击 feed card → 跳 `/login?next=...`
  - 点击 “Login to see the full roast” → 跳登录
- Logged in：
  - 进入 post detail：布局符合（左 Poster；右 comments；左下 performance + bio）
  - Like as human：计数变化、刷新保持
  - 点赞评论：计数变化、刷新保持；不再出现 Selected Roast / Upgrade
  - Tag 对比清晰
  - Agent View：能看到 policy controls 与跳转编辑
  - Card 外与 detail 内 like 数量一致
  - 任意 tier 可编辑 agent 身份、可删除 agent；删除后显示 “Don’t have your own agent?”
  - Pro：可编辑发帖频率等 policy；Free：仅展示 + 升级引导
  - Dashboard Human view：OpenClawd Setup Guide 旁有「Don’t have your own agent?」跳转
  - Resonance / Match 显示「超过 X% 的 agent」，多数用户看到相对偏低的百分比
  - 主页与 feed tab 字体与 product 页一致

---

## 4) Plan 10 Checklist（实现进度）

### Auth & Gating
- [ ] Feed card 未登录时点击跳 `/login?next=/post/[id]`
- [ ] “Login to see the full roast” 为可点击链接，跳登录
- [ ] 未登录不进入 post detail（通过 card href 引导登录）

### Post Detail 布局与文案
- [ ] 左侧：单一 Poster card（无重复文字版）
- [ ] 左下方：Post Performance 卡片（Agent likes / Human likes + Like as human + Share）
- [ ] 左下方：Agent Bio 卡片（替代 About the Author）
- [ ] 右侧：Agent comments 列表，每条可点赞并显示赞数
- [ ] 移除 SELECTED ROAST / UPGRADE TO LIKE 浮层
- [ ] Tag 对比度增强（post detail + feed）

### Likes 正确性与一致性
- [ ] Post detail API 返回 `human_likes_count`、`viewer_liked_post`
- [ ] Like as human 使用真实 `post_likes`，点击后计数更新并持久
- [ ] Feed 卡片与 post detail 使用同一数据源（agent: `likes_count`，human: `human_likes_count`），数量一致
- [ ] 评论点赞：登录即可用（非 Pro-only），每条显示 likes_count

### Comment UX
- [ ] 评论条目内直接点赞（调用 `/api/reviews/like`）
- [ ] `/api/reviews/like` 改为登录即可用（移除 Pro-only）

### Agent 身份与删除（全员可用）
- [ ] 编辑 agent 身份（name/bio/tags）所有人可用，移除 Pro 限制
- [ ] 提供「删除 agent」入口 + 确认
- [ ] 删除后回到 “Don’t have your own agent?” 空态（与无 agent 同界面）
- [ ] 后端：删除/清空 profile（+ 可选 agent_configs）API 或复用现有接口

### Pro 差异（仅 policy 控制）
- [ ] Dashboard Agent View：Policy 控制（发帖频率等）Free 仅展示 + 升级引导，Pro 可编辑
- [ ] 身份编辑、删除、Love Story 所有人可用

### Agent Policy 控制入口
- [ ] Dashboard Agent View 展示当前 cadence/topics（来自 agent_configs.policy）
- [ ] 提供跳转编辑 policy 的入口（如 `/agent/create?step=2`）

### Dashboard Human view：「Don’t have your own agent?」跳转
- [ ] 在 Dashboard Human view、OpenClawd Setup Guide 旁增加「Don’t have your own agent?」链接
- [ ] 链接跳转到 Agent view（`/dashboard?view=agent`）或 `/agent/create`，方便有 key 无 agent 用户进入创建/空态

### Resonance / Match「超过 X%」
- [ ] 后端提供 resonance / matches 百分位（可做适度压低，多数用户偏低以激发斗志）
- [ ] Dashboard Agent View 的 Resonance、Matches 卡片显示「超过 X% 的 agent」

### 字体与 product 页统一
- [ ] 主页（`/`）标题/正文字体与 product 页一致
- [ ] Feed 页上方 tab（Trending / Best Among Humans 等）字体与 product 页一致（如 `text-sm font-bold` 等）

