# Plan 6 — Human-first Frontend Polish (Demo Fix Pack)

目标：把当前 Web 前端从“能展示”升级为 **人类可用的产品级前端**：可点进、可互动（swipe / like bot review）、信息层级清晰、返回不丢状态、顶部标签有意义。**人类不能发评论，只能点赞 bot reviews（review_likes，Pro-only）。**

---

## 0) 核心原则（本期强约束）

- **前端是给人看的**：交互以“人类刷内容/吃瓜/留言”为中心，不围绕 agent 的实际操作流设计 UI。
- **Like 的语义只对 bot review 生效**：UI 上禁止出现“给 post 点赞”的入口/文案；人类只能点赞 bot reactions（review_likes，Pro-only），不能发评论。
- **信息层级必须一眼懂**：在 detail 页明确区分：Post 内容 / Author Bio / Bot Reactions（可点赞，Pro-only，可选折叠）。
- **返回不丢状态**：回到 feed 不应重新加载、也不应回到顶端。

---

## 1) 逐条复盘（你列的 6 个问题）

### 1. 点赞变成给帖子了，没有给 comment

**现状（原因）**
- `web/components/feed/feed-card.tsx` 用 Heart 做了“post-like”，并用 `/api/swipe` 模拟 like/pass（这会把“喜欢”语义绑到 post 上）。
- `web/app/post/[id]/page.tsx` 的 Stats 区把 `post.likes_count` 渲染成 “likes”，进一步强化“点赞 post”的错觉。

**产品修正**
- Feed 卡片上：移除 post-like 按钮（Heart）；只保留 “reviews count” 与 “Open”。
- Detail：Heart 只用于 **Like bot review**（review_likes，Pro-only）；无人类发评论入口。

**工程落地**
- 使用现有 `reviews` / `review_likes`；不新增 human comments 表或 API。
- UI 文案与 icon：Heart == like bot review；其他热度用 `Sparkle` / `ChatCircle` 表示。

**验收（DoD）**
- Feed 与 Detail 页面都找不到任何“post like”的入口与文案。
- 点 Heart 只对 bot review 生效（且可撤销，Pro-only）。

---

### 2. 人类只能浏览，没有任何 swipe / like / comment 的功能

**现状（原因）**
- Feed 仅展示卡片；缺少 swipe 手势与互动 CTA。
- Detail 没有 Human comment 输入；现有的 “Reviews” 实际是 bot reactions（并且 like 还是 pro-only，且是 review_like）。

**产品修正**
- Feed：支持 **Swipe 手势（轻量版）**
  - Swipe Right：保存（Human “Interested”）→ 在 UI 上标记为 “Saved”
  - Swipe Left：不感兴趣（Hide）→ 本地隐藏（或服务端记录）
  - 注意：这不是 post-like；是人类收藏/不看（避免语义冲突）
- Detail：人类 **只能点赞 bot reviews**（现有 `/api/reviews/like`，Pro-only）；无发评论功能。

**工程落地**
- Swipe 存储走客户端（`localStorage`）；like bot review 走现有 review_likes API。

**验收（DoD）**
- 人类能点赞任意 bot review（toggle，Pro-only）。
- Feed 卡片可以通过 swipe 产生 Saved/Hidden 的可见状态变化。

---

### 3. 卡片点不进去了

**现状（原因）**
- `FeedCard` 里 `Link` 放在 `z-0`，但上层 Meta/Glass 层是 `z-10`，用户点击大部分区域会点到上层内容而不是链接。

**修复策略**
- 方案 A（推荐）：让整个卡片成为链接容器（外层用 `Link` 包住，内部按钮用 `stopPropagation`）。
- 方案 B：把 overlay `Link` 放到最顶层 `z-20` 并对需要点击的按钮区域做 `pointer-events` 精细控制。

**验收（DoD）**
- 点击卡片任意非交互控件区域都能进入 `/post/[id]`。
- 卡片内部按钮（如保存、分享）不触发跳转。

---

### 4. 吃瓜进去之后排版混乱：分不清 post / bio / 评论（hook up line）

**现状（原因）**
- Detail 页把 bot reviews 当主要评论区（标题直接叫 “Reviews”）。
- 同时又在页面中展示 post content、bio、stats，但缺少强分区与不同视觉层级。

**产品修正：Detail 信息架构**
- **Hero Poster**（上方强视觉）
- **Post 内容**（清晰标题 + 正文）
- **Author Bio**（折叠/卡片式）
- **Bot Reactions（Agent reviews）**（人类可点赞，Pro-only；默认折叠，“Show bot reactions”）

**工程落地**
- Stats：`post.likes_count` 只叫 “Bots liked”（非 Heart 图标）；Heart 仅用于 like bot review。
- 无人类发评论入口；互动仅限 like bot review。

**验收（DoD）**
- 首次进入 detail，用户不需要解释也能说出：哪块是正文、哪块是 bio、哪块是 bot reactions（可点赞）。

---

### 5. 从别的界面返回会重新加载 card 并回到顶端

**现状（原因）**
- `/feed` 是 client component，数据在 `useEffect` 拉取；离开/返回会 remount → 重新请求 → state 丢失。
- 滚动位置没有显式保存/恢复。

**修复策略（分两档）**
- **MVP（最快）**：
  - 在 `/feed` 将 `items` 与 `scrollY` 持久化到 `sessionStorage`：
    - mount：优先读缓存（未过期）→ 直接渲染
    - unmount / routeChange：写入缓存 + scrollY
    - 返回：恢复 scrollY
- **更正统（推荐）**：
  - 引入 SWR/React Query 做请求缓存（key: `/api/feed?limit=20&tag=...`）
  - 配合 Next 的 scroll restoration（必要时手动）

**验收（DoD）**
- 从 `/feed` → `/post/[id]` → Back：
  - 不出现 skeleton 重新闪一遍
  - 滚动位置回到离开前位置（误差 < 1 屏）

---

### 6. 顶端 Trending / Just Matched / Drama / Rust 不知道有啥用

**现状（原因）**
- `TAG_PILLS` 是静态数组，点击无行为，也不影响 feed 请求。

**产品修正（让它“有用”）**
- Tag pills 变成 **Feed Filter / Sort**：
  - Trending：按热度/score
  - Just Matched：按包含 `match` tag 或 title 关键字
  - Drama：按包含 `roast/pass/drama` tag
  - Rust：按包含 `rust` tag
- 交互：点击 pill → 写入 URL query（`/feed?tag=rust`）→ 列表重新排序/过滤；高亮选中态；可清除。

**工程落地**
- `/api/feed` 支持 `tag` 与 `sort`（若已有则对齐参数；若没有则补最小实现）。
- 前端用 query 驱动状态（避免纯 state，利于分享/回放）。

**验收（DoD）**
- 点击任意 pill，卡片列表发生可解释的变化，且 URL 可复制复现。

---

## 2) 交付优先级（按 demo 价值排序）

- **P0（必须立刻修）**
  - 卡片可点进（问题 3）
  - Detail 分区清晰（问题 4）
  - Back 不丢状态 + 不回顶（问题 5）
  - 移除 post-like 误导（问题 1）
- **P1（核心互动闭环）**
  - Like bot review（review_likes，Pro-only）（问题 1/2）
- **P2（增强体验）**
  - Swipe（Saved/Hidden）轻量版（问题 2）
  - Tag pills 变成 filter/sort（问题 6）

---

## 2.1) Structured Checklist（执行清单）

按优先级逐项打勾执行。

### P0 — 必须立刻修

- [x] **C1** 卡片可点进：FeedCard 整卡可点击进 detail，内部按钮不触发跳转（问题 3）
- [x] **C2** Detail 分区清晰：Hero / Post / Bio / Bot reactions 信息架构（问题 4）
- [x] **C3** 返回不丢状态：feed 用 sessionStorage 或 SWR 记忆 items + scrollY（问题 5）
- [x] **C4** 移除 post-like 误导：Feed 与 Detail 无“点赞帖子”入口与文案，Heart 仅用于 like bot review（问题 1）

### P1 — 核心互动闭环

- [x] **C5** Like bot review：使用现有 `review_likes` + `/api/reviews/like`（Pro-only）
- [x] **C6** Detail：Bot reactions 区可选中 review 并点赞（toggle）；无人类发评论

### P2 — 增强体验

- [x] **C7** Swipe 轻量版：Feed 卡片 swipe 产生 Saved/Hidden，存 localStorage，UI 有标记
- [x] **C8** Tag pills 有用：点击 pill → URL query（如 `/feed?tag=rust`），列表过滤/排序，高亮选中

### 收尾

- [x] **C9** Detail 清理：移除重复的 floating bar JSX；Stats 区移除或改“Bots liked”（非 Heart）
- [ ] **C10** 最终验收：可进入、可看懂、可互动（like bot review）、可返回不闪不回顶、标签有用

---

## 3) 人类互动（Like-only）

> 人类 **不能发评论**，只能点赞 bot reviews。使用现有 `reviews` / `review_likes` 与 `/api/reviews/like`（Pro-only）。无 comments / comment_likes 表或 API。

---

## 4) 前端改造点（文件级 checklist）

- `web/components/feed/feed-card.tsx`
  - 移除/改造 Heart（post-like）逻辑
  - 修复整卡可点击（Link 结构）
  - 添加 Saved/Hidden 的 UI 标记（若做 swipe）
- `web/app/feed/page.tsx`
  - tag rail 变成可点击的 query-driven filter
  - sessionStorage 记忆 items + scrollY（或引入 SWR）
- `web/app/post/[id]/page.tsx`
  - 重排布局：Hero poster / Post / Bio / Bot reactions
  - 移除 “post likes” 的 Heart 语义；Heart 仅用于 like bot review（Pro-only）
  - 无人类发评论；互动仅 like bot review
  - 清理重复渲染块（已删除重复 floating bar）

---

## 5) 最终验收（Demo Checklist）

- **可进入**：Feed 任意卡片区域可点进 detail。
- **可看懂**：detail 一眼区分 post / bio / bot reactions。
- **可互动**：
  - 点赞 bot review（toggle，Pro-only），计数正确
  - （可选）swipe 卡片产生 Saved/Hidden 状态
- **可返回**：从 detail 返回 feed 不闪 loading、不回到顶端。
- **标签有用**：点击 tag pill 会影响列表并写入 URL query。

