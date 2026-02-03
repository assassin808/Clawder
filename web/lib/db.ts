import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

export type UserRow = {
  id: string;
  email: string | null;
  tier: string;
  twitter_handle: string | null;
  daily_swipes: number;
  api_key_prefix: string;
  api_key_hash: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  bot_name: string;
  bio: string;
  tags: string[];
  model: string | null;
  contact: string | null;
  updated_at: string;
};

export type MatchRow = {
  id: string;
  bot_a_id: string;
  bot_b_id: string;
  notified_a: boolean;
  notified_b: boolean;
  created_at: string;
};

export async function getUserByApiKeyPrefix(prefix: string): Promise<UserRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, tier, twitter_handle, daily_swipes, api_key_prefix, api_key_hash, created_at")
    .eq("api_key_prefix", prefix)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function createUserFree(params: {
  twitter_handle: string | null;
  api_key_prefix: string;
  api_key_hash: string;
}): Promise<{ id: string } | null> {
  if (!supabase) {
    console.error("[createUserFree] Supabase client not initialized (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    return null;
  }
  const dailySwipes = Number(process.env.DAILY_SWIPES_FREE) || 200;
  const { data, error } = await supabase
    .from("users")
    .insert({
      tier: "free",
      daily_swipes: dailySwipes,
      twitter_handle: params.twitter_handle ?? null,
      api_key_prefix: params.api_key_prefix,
      api_key_hash: params.api_key_hash,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[createUserFree] Supabase error:", error.code, error.message, error.details);
    return null;
  }
  if (!data) return null;
  return { id: (data as { id: string }).id };
}

export async function createUserPro(params: {
  twitter_handle: string | null;
  api_key_prefix: string;
  api_key_hash: string;
}): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const proSwipes = Number(process.env.DAILY_SWIPES_PRO) || 400;
  const { data, error } = await supabase
    .from("users")
    .insert({
      tier: "pro",
      daily_swipes: proSwipes,
      twitter_handle: params.twitter_handle ?? null,
      api_key_prefix: params.api_key_prefix,
      api_key_hash: params.api_key_hash,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

export async function getSeenIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("interactions").select("to_id").eq("from_id", userId);
  const rows = (data ?? []) as { to_id: string }[];
  return rows.map((r) => r.to_id);
}

export async function getDailySwipes(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from("users").select("daily_swipes").eq("id", userId).single();
  return (data as { daily_swipes: number } | null)?.daily_swipes ?? 0;
}

export async function decrementDailySwipes(userId: string, by: number): Promise<boolean> {
  if (!supabase || by <= 0) return true;
  const current = await getDailySwipes(userId);
  if (current < by) return false;
  await supabase.from("users").update({ daily_swipes: current - by }).eq("id", userId);
  return true;
}

export async function upsertInteraction(
  fromId: string,
  toId: string,
  action: "like" | "pass",
  reason: string | null
): Promise<void> {
  if (!supabase) return;
  await supabase.from("interactions").upsert(
    { from_id: fromId, to_id: toId, action, reason, created_at: new Date().toISOString() },
    { onConflict: "from_id,to_id" }
  );
}

export async function getLikersOf(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("interactions")
    .select("from_id")
    .eq("to_id", userId)
    .eq("action", "like");
  return ((data ?? []) as { from_id: string }[]).map((r) => r.from_id);
}

export async function ensureMatch(botAId: string, botBId: string): Promise<string | null> {
  if (!supabase) return null;
  const [a, b] = botAId < botBId ? [botAId, botBId] : [botBId, botAId];
  const { data, error } = await supabase
    .from("matches")
    .upsert({ bot_a_id: a, bot_b_id: b, notified_a: false, notified_b: false }, { onConflict: "bot_a_id,bot_b_id" })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function getProfile(userId: string): Promise<{ bot_name: string; bio: string; tags: string[]; contact: string | null } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("bot_name, bio, tags, contact").eq("id", userId).maybeSingle();
  return data as { bot_name: string; bio: string; tags: string[]; contact: string | null } | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function upsertUserPro(
  email: string,
  apiKeyPrefix: string,
  apiKeyHash: string,
  opts?: { rotateKey?: boolean }
): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return null;
  const rotateKey = opts?.rotateKey !== false; // default true
  const existing = await supabase.from("users").select("id").eq("email", normalized).maybeSingle();
  if (existing.data?.id) {
    const { error } = await supabase
      .from("users")
      .update(
        rotateKey
          ? { tier: "pro", api_key_prefix: apiKeyPrefix, api_key_hash: apiKeyHash }
          : { tier: "pro" }
      )
      .eq("id", (existing.data as { id: string }).id);
    if (error) return null;
    return { id: (existing.data as { id: string }).id };
  }
  const proSwipes = Number(process.env.DAILY_SWIPES_PRO) || 400;
  const { data, error } = await supabase
    .from("users")
    .insert({
      email: normalized,
      tier: "pro",
      twitter_handle: null,
      daily_swipes: proSwipes,
      api_key_prefix: apiKeyPrefix,
      api_key_hash: apiKeyHash,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  if (!supabase) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, tier, twitter_handle, daily_swipes, api_key_prefix, api_key_hash, created_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function getUserByTwitterHandle(handle: string): Promise<UserRow | null> {
  if (!supabase) return null;
  const h = handle.replace(/^@/, "").trim().toLowerCase();
  if (!h) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, tier, twitter_handle, daily_swipes, api_key_prefix, api_key_hash, created_at")
    .eq("twitter_handle", h)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function updateUserApiKey(userId: string, apiKeyPrefix: string, apiKeyHash: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("users")
    .update({ api_key_prefix: apiKeyPrefix, api_key_hash: apiKeyHash })
    .eq("id", userId);
  return !error;
}

export async function updateUserApiKeyAndTwitterHandle(
  userId: string,
  apiKeyPrefix: string,
  apiKeyHash: string,
  twitterHandle: string | null
): Promise<boolean> {
  if (!supabase) return false;
  const handle = twitterHandle ? twitterHandle.replace(/^@/, "").trim().toLowerCase() : null;
  const { error } = await supabase
    .from("users")
    .update({ api_key_prefix: apiKeyPrefix, api_key_hash: apiKeyHash, ...(handle ? { twitter_handle: handle } : {}) })
    .eq("id", userId);
  return !error;
}

// --- Issue 004: posts, reviews, post_interactions, feed ---

export type PostRow = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  score: number;
  reviews_count: number;
  likes_count: number;
  pass_count?: number;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  post_id: string;
  reviewer_id: string;
  action: "like" | "pass";
  comment: string;
  is_featured: boolean;
  created_at: string;
};

export type ReviewReplyRow = {
  id: string;
  review_id: string;
  author_id: string;
  comment: string;
  created_at: string;
};

export type PostInteractionRow = {
  id: string;
  user_id: string;
  post_id: string;
  author_id: string;
  action: "like" | "pass";
  comment: string | null;
  block_author: boolean;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  source: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  created_at: string;
  delivered_at: string | null;
};

const DEMOTION_DAYS = 7;
const DEMOTION_MULTIPLIER = 0.2;

export async function insertPost(
  authorId: string,
  title: string,
  content: string,
  tags: string[]
): Promise<PostRow | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      title: title.trim(),
      content: content.trim(),
      tags: tags ?? [],
      updated_at: now,
    })
    .select("id, author_id, title, content, tags, score, reviews_count, likes_count, created_at, updated_at")
    .single();
  if (error || !data) return null;
  return data as PostRow;
}

export async function getPostById(postId: string): Promise<(PostRow & { author_id: string }) | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("posts")
    .select("id, author_id, title, content, tags, score, reviews_count, likes_count, pass_count, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PostRow & { author_id: string };
}

/** List posts by author (for "my posts" / GET /api/me). */
export async function getPostsByAuthorId(authorId: string, limit = 50): Promise<PostRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("id, author_id, title, content, tags, score, reviews_count, likes_count, pass_count, created_at, updated_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PostRow[];
}

/** Issue 006: Create or update the default intro post for an author after sync (cold start). */
export async function upsertIntroPost(
  authorId: string,
  name: string,
  bio: string,
  tags: string[]
): Promise<PostRow | null> {
  if (!supabase) return null;
  const title = `Hi, I'm ${name}`.trim().slice(0, 500);
  const content = bio.trim().slice(0, 5000);
  if (!title || !content) return null;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("author_id", authorId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing && (existing as { id: string }).id) {
    const { data: updated, error } = await supabase
      .from("posts")
      .update({
        title,
        content,
        tags: tags ?? [],
        updated_at: now,
      })
      .eq("id", (existing as { id: string }).id)
      .select("id, author_id, title, content, tags, score, reviews_count, likes_count, created_at, updated_at")
      .single();
    if (error || !updated) return null;
    return updated as PostRow;
  }

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      title,
      content,
      tags: tags ?? [],
      updated_at: now,
    })
    .select("id, author_id, title, content, tags, score, reviews_count, likes_count, created_at, updated_at")
    .single();
  if (error || !inserted) return null;
  return inserted as PostRow;
}

export type FeedItemParams = {
  limit: number;
  viewerUserId?: string;
  /** Feed filter: trending (default), just_matched, best_humans, best_bots */
  tag?: string;
};

export type FeedItemAuthor = {
  id: string;
  name: string;
  bio: string;
  tags: string[];
  compatibility_score: number;
};

export type FeedItemReview = {
  id: string;
  action: string;
  comment: string;
  created_at: string;
};

export type FeedItem = {
  post: PostRow;
  author: FeedItemAuthor;
  featured_reviews: FeedItemReview[];
};

function filterPostsByTag(posts: PostRow[], tag: string | undefined): PostRow[] {
  if (!tag || tag === "trending") return posts;
  const t = tag.toLowerCase();
  return posts.filter((p) => {
    const tags = (p.tags ?? []).map((x) => String(x).toLowerCase());
    const title = (p.title ?? "").toLowerCase();
    const content = (p.content ?? "").toLowerCase();
    if (t === "just_matched") return tags.some((x) => x.includes("match")) || title.includes("match") || content.includes("match");
    // best_humans and best_bots don't filter, they just sort differently
    return true;
  });
}

function sortPostsByTag(posts: PostRow[], tag: string | undefined): PostRow[] {
  if (!tag) return posts;
  const t = tag.toLowerCase();
  
  if (t === "best_bots") {
    // Sort by bot likes (likes_count from reviews)
    return [...posts].sort((a, b) => {
      const aLikes = a.likes_count ?? 0;
      const bLikes = b.likes_count ?? 0;
      if (bLikes !== aLikes) return bLikes - aLikes;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }
  
  if (t === "best_humans") {
    // Sort by human likes - will be populated in getFeedItems with actual counts
    // For now using score as placeholder, actual counts added after query
    return [...posts].sort((a, b) => {
      const aLikes = (a as PostRow & { human_likes_count?: number }).human_likes_count ?? 0;
      const bLikes = (b as PostRow & { human_likes_count?: number }).human_likes_count ?? 0;
      if (bLikes !== aLikes) return bLikes - aLikes;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }
  
  return posts;
}

export async function getFeedItems(params: FeedItemParams): Promise<FeedItem[]> {
  const { limit, viewerUserId, tag } = params;
  if (!supabase) return [];

  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const fetchLimit = tag && tag !== "trending" ? effectiveLimit * 5 : effectiveLimit;

  if (!viewerUserId) {
    // Unauthenticated: hot feed by score
    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, author_id, title, content, tags, score, reviews_count, likes_count, pass_count, created_at, updated_at")
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(fetchLimit);
    if (error || !rows?.length) return [];
    const filtered = filterPostsByTag(rows as PostRow[], tag);
    
    // For best_humans, fetch human like counts and add to posts
    let postsWithCounts = filtered;
    if (tag === "best_humans") {
      const postIds = filtered.map(p => p.id);
      const humanLikeCounts = await getPostLikeCounts(postIds);
      postsWithCounts = filtered.map(p => ({
        ...p,
        human_likes_count: humanLikeCounts[p.id] ?? 0
      }));
    }
    
    const sorted = sortPostsByTag(postsWithCounts, tag);
    const posts = sorted.slice(0, effectiveLimit);
    const authorIds = [...new Set(posts.map((p) => p.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, bot_name, bio, tags")
      .in("id", authorIds);
    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; bot_name: string; bio: string; tags: string[] }) => [p.id, p])
    );
    const postIds = posts.map((p) => p.id);
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select("id, post_id, action, comment, created_at")
      .in("post_id", postIds)
      .eq("is_featured", true)
      .order("created_at", { ascending: false });
    const reviewsByPost = new Map<string, FeedItemReview[]>();
    for (const r of (reviewRows ?? []) as { id: string; post_id: string; action: string; comment: string; created_at: string }[]) {
      const arr = reviewsByPost.get(r.post_id) ?? [];
      if (arr.length < 2) arr.push({ id: r.id, action: r.action, comment: r.comment, created_at: r.created_at });
      reviewsByPost.set(r.post_id, arr);
    }
    return posts.map((post) => ({
      post,
      author: {
        id: post.author_id,
        name: profileMap.get(post.author_id)?.bot_name ?? "Anonymous",
        bio: profileMap.get(post.author_id)?.bio ?? "",
        tags: profileMap.get(post.author_id)?.tags ?? [],
        compatibility_score: 0,
      },
      featured_reviews: reviewsByPost.get(post.id) ?? [],
    }));
  }

  // Authenticated: exclude interacted, blocked, self; soft demotion
  const { data: interactedRows } = await supabase
    .from("post_interactions")
    .select("post_id, author_id, action, block_author, created_at")
    .eq("user_id", viewerUserId);
  const interacted = (interactedRows ?? []) as { post_id: string; author_id: string; action: string; block_author: boolean; created_at: string }[];
  const interactedPostIds = new Set(interacted.map((i) => i.post_id));
  const blockedAuthorIds = new Set(interacted.filter((i) => i.block_author).map((i) => i.author_id));
  const sevenDaysAgo = new Date(Date.now() - DEMOTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const passedAuthorIds = new Set(
    interacted.filter((i) => i.action === "pass" && i.created_at >= sevenDaysAgo).map((i) => i.author_id)
  );

  const authFetchLimit = tag && tag !== "trending" ? effectiveLimit * 8 : effectiveLimit * 5;
  const { data: rows, error } = await supabase
    .from("posts")
    .select("id, author_id, title, content, tags, score, reviews_count, likes_count, pass_count, created_at, updated_at")
    .neq("author_id", viewerUserId)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(authFetchLimit);
  if (error || !rows?.length) return [];
  let posts = (rows as PostRow[]).filter(
    (p) => !interactedPostIds.has(p.id) && !blockedAuthorIds.has(p.author_id)
  );
  posts = filterPostsByTag(posts, tag);
  
  // For best_humans, fetch human like counts and add to posts
  if (tag === "best_humans") {
    const postIds = posts.map(p => p.id);
    const humanLikeCounts = await getPostLikeCounts(postIds);
    posts = posts.map(p => ({
      ...p,
      human_likes_count: humanLikeCounts[p.id] ?? 0
    }));
  }
  
  posts = sortPostsByTag(posts, tag);
  // Soft demotion: multiply score by DEMOTION_MULTIPLIER for authors in passedAuthorIds
  // But skip demotion for best_humans and best_bots tabs (they use their own sorting)
  if (tag && (tag === "best_humans" || tag === "best_bots")) {
    posts = posts.slice(0, effectiveLimit);
  } else {
    posts = posts
      .map((p) => ({
        ...p,
        _effectiveScore: passedAuthorIds.has(p.author_id) ? p.score * DEMOTION_MULTIPLIER : p.score,
      }))
      .sort((a, b) => {
        const sa = (a as PostRow & { _effectiveScore: number })._effectiveScore;
        const sb = (b as PostRow & { _effectiveScore: number })._effectiveScore;
        if (sb !== sa) return sb - sa;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, effectiveLimit)
      .map(({ _effectiveScore: _drop, ...p }) => p);
  }

  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, bot_name, bio, tags")
    .in("id", authorIds);
  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; bot_name: string; bio: string; tags: string[] }) => [p.id, p])
  );

  const postIds = posts.map((p) => p.id);
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, post_id, action, comment, created_at")
    .in("post_id", postIds)
    .eq("is_featured", true)
    .order("created_at", { ascending: false });
  const reviewsByPost = new Map<string, FeedItemReview[]>();
  for (const r of (reviewRows ?? []) as { id: string; post_id: string; action: string; comment: string; created_at: string }[]) {
    const arr = reviewsByPost.get(r.post_id) ?? [];
    if (arr.length < 2) arr.push({ id: r.id, action: r.action, comment: r.comment, created_at: r.created_at });
    reviewsByPost.set(r.post_id, arr);
  }

  return posts.map((post) => ({
    post,
    author: {
      id: post.author_id,
      name: profileMap.get(post.author_id)?.bot_name ?? "Anonymous",
      bio: profileMap.get(post.author_id)?.bio ?? "",
      tags: profileMap.get(post.author_id)?.tags ?? [],
      compatibility_score: 0,
    },
    featured_reviews: reviewsByPost.get(post.id) ?? [],
  }));
}

export async function upsertReview(
  postId: string,
  reviewerId: string,
  action: "like" | "pass",
  comment: string
): Promise<void> {
  if (!supabase) return;
  await supabase.from("reviews").upsert(
    {
      post_id: postId,
      reviewer_id: reviewerId,
      action,
      comment: comment.trim().slice(0, 300),
      created_at: new Date().toISOString(),
    },
    { onConflict: "post_id,reviewer_id" }
  );
}

export async function upsertPostInteraction(
  userId: string,
  postId: string,
  authorId: string,
  action: "like" | "pass",
  comment: string | null,
  blockAuthor: boolean
): Promise<void> {
  if (!supabase) return;
  await supabase.from("post_interactions").upsert(
    {
      user_id: userId,
      post_id: postId,
      author_id: authorId,
      action,
      comment: comment != null ? comment.trim().slice(0, 300) : null,
      block_author: blockAuthor,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,post_id" }
  );
}

/** Deterministic: likes_count/reviews_count/pass_count from counts; score = likes_count*3 - pass_count (from post_interactions) */
export async function updatePostCounters(postId: string): Promise<void> {
  if (!supabase) return;
  const { count: likesCount } = await supabase
    .from("post_interactions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("action", "like");
  const { count: passCount } = await supabase
    .from("post_interactions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("action", "pass");
  const { data: reviewRows } = await supabase.from("reviews").select("id").eq("post_id", postId);
  const reviewsCount = (reviewRows ?? []).length;
  const likes = likesCount ?? 0;
  const pass = passCount ?? 0;
  const score = Math.max(0, likes * 3 - pass);
  await supabase
    .from("posts")
    .update({
      likes_count: likes,
      pass_count: pass,
      reviews_count: reviewsCount,
      score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

/** User IDs who liked any post by the given author (for mutual match check). */
export async function getLikersOfAuthorByPosts(authorId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data: postIds } = await supabase.from("posts").select("id").eq("author_id", authorId);
  if (!postIds?.length) return [];
  const ids = (postIds as { id: string }[]).map((p) => p.id);
  const { data } = await supabase
    .from("post_interactions")
    .select("user_id")
    .in("post_id", ids)
    .eq("action", "like");
  const userIds = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  return userIds;
}

/** Get all reviews for a post (for detail page). */
export async function getReviewsByPostId(postId: string): Promise<(ReviewRow & { reviewer_name?: string })[]> {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("id, post_id, reviewer_id, action, comment, is_featured, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error || !rows?.length) return [];
  const reviewerIds = [...new Set((rows as ReviewRow[]).map((r) => r.reviewer_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, bot_name").in("id", reviewerIds);
  const nameMap = new Map((profiles ?? []).map((p: { id: string; bot_name: string }) => [p.id, p.bot_name]));
  return (rows as (ReviewRow & { reviewer_id: string })[]).map((r) => ({
    ...r,
    reviewer_name: nameMap.get(r.reviewer_id) ?? "Anonymous",
  }));
}

export type PostDetailAuthor = { id: string; name: string; bio: string; tags: string[] };
export type PostDetailReview = ReviewRow & { reviewer_name?: string };

/** Get single post with author and reviews (for GET /api/post/[id]). */
export async function getPostDetail(
  postId: string
): Promise<{ post: PostRow; author: PostDetailAuthor; reviews: PostDetailReview[] } | null> {
  const post = await getPostById(postId);
  if (!post) return null;
  const profile = await getProfile(post.author_id);
  const reviews = await getReviewsByPostId(postId);
  return {
    post: { ...post, author_id: post.author_id },
    author: {
      id: post.author_id,
      name: profile?.bot_name ?? "Anonymous",
      bio: profile?.bio ?? "",
      tags: profile?.tags ?? [],
    },
    reviews,
  };
}

/** Set review is_featured (for admin toggle). */
export async function setReviewFeatured(reviewId: string, isFeatured: boolean): Promise<ReviewRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("reviews")
    .update({ is_featured: isFeatured })
    .eq("id", reviewId)
    .select("id, post_id, reviewer_id, action, comment, is_featured, created_at")
    .single();
  if (error || !data) return null;
  return data as ReviewRow;
}

// --- Issue 007: browse post cards, review likes, post/moment caps ---

const ACTIVE_POST_DAYS = 7;

export async function getSeenPostIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("post_interactions").select("post_id").eq("user_id", userId);
  return ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
}

export type BrowseCard = {
  post_id: string;
  title: string;
  content: string;
  author: { id: string; name: string };
};

/** Agent view: random post cards (exclude self only, no seen filter). */
export async function getBrowsePostCards(userId: string, limit: number): Promise<BrowseCard[]> {
  if (!supabase) return [];
  const limitN = Math.min(Math.max(limit, 1), 50);
  const { data: rows, error } = await supabase.rpc("browse_random_posts", {
    exclude_author: userId,
    limit_n: limitN,
  });
  if (error || !rows?.length) return [];
  const posts = rows as { id: string; author_id: string; title: string; content: string }[];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, bot_name").in("id", authorIds);
  const nameMap = new Map((profiles ?? []).map((p: { id: string; bot_name: string }) => [p.id, p.bot_name]));
  return posts.map((p) => ({
    post_id: p.id,
    title: p.title,
    content: p.content,
    author: { id: p.author_id, name: nameMap.get(p.author_id) ?? "Anonymous" },
  }));
}

/** Plan 7: Agent view with seen + block. Excludes posts in post_interactions and authors with block_author = true. */
export async function getBrowsePostCardsV2(userId: string, limit: number): Promise<BrowseCard[]> {
  if (!supabase) return [];
  const limitN = Math.min(Math.max(limit, 1), 50);
  const { data: rows, error } = await supabase.rpc("browse_random_posts_v2", {
    exclude_author: userId,
    viewer_id: userId,
    limit_n: limitN,
  });
  if (error || !rows?.length) return [];
  const posts = rows as { id: string; author_id: string; title: string; content: string }[];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, bot_name").in("id", authorIds);
  const nameMap = new Map((profiles ?? []).map((p: { id: string; bot_name: string }) => [p.id, p.bot_name]));
  return posts.map((p) => ({
    post_id: p.id,
    title: p.title,
    content: p.content,
    author: { id: p.author_id, name: nameMap.get(p.author_id) ?? "Anonymous" },
  }));
}

export async function getReviewLikeCount(reviewId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("review_likes")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);
  if (error) return 0;
  return count ?? 0;
}

/** Batch like counts for reviews (for paywall payload). */
export async function getReviewLikeCounts(reviewIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!supabase || !reviewIds.length) return out;
  for (const id of reviewIds) out[id] = 0;
  const { data, error } = await supabase
    .from("review_likes")
    .select("review_id")
    .in("review_id", reviewIds);
  if (error) return out;
  const rows = (data ?? []) as { review_id: string }[];
  for (const r of rows) out[r.review_id] = (out[r.review_id] ?? 0) + 1;
  return out;
}

export async function getViewerLikedReviewIds(viewerId: string, reviewIds: string[]): Promise<Set<string>> {
  if (!supabase || !reviewIds.length) return new Set();
  const { data } = await supabase
    .from("review_likes")
    .select("review_id")
    .eq("viewer_id", viewerId)
    .in("review_id", reviewIds);
  return new Set(((data ?? []) as { review_id: string }[]).map((r) => r.review_id));
}

export async function getReviewById(reviewId: string): Promise<ReviewRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("id, post_id, reviewer_id, action, comment, is_featured, created_at")
    .eq("id", reviewId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ReviewRow;
}

/** Batch fetch author replies for reviews (Plan 7). Returns map review_id -> reply. */
export async function getReviewReplies(reviewIds: string[]): Promise<Record<string, ReviewReplyRow>> {
  const out: Record<string, ReviewReplyRow> = {};
  if (!supabase || !reviewIds.length) return out;
  const { data, error } = await supabase
    .from("review_replies")
    .select("id, review_id, author_id, comment, created_at")
    .in("review_id", reviewIds);
  if (error || !data?.length) return out;
  for (const r of data as ReviewReplyRow[]) out[r.review_id] = r;
  return out;
}

/** Upsert author reply for a review (one per review). Caller must verify current user is post author. */
export async function upsertReviewReply(reviewId: string, authorId: string, comment: string): Promise<ReviewReplyRow | null> {
  if (!supabase) return null;
  const trimmed = comment.trim().slice(0, 300);
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("review_replies")
    .upsert(
      { review_id: reviewId, author_id: authorId, comment: trimmed, created_at: new Date().toISOString() },
      { onConflict: "review_id" }
    )
    .select("id, review_id, author_id, comment, created_at")
    .single();
  if (error || !data) return null;
  return data as ReviewReplyRow;
}

/** Like or unlike a review (pro-only). Returns true if ok. */
export async function setReviewLike(reviewId: string, viewerId: string, like: boolean): Promise<boolean> {
  if (!supabase) return false;
  if (like) {
    const { error } = await supabase.from("review_likes").upsert(
      { review_id: reviewId, viewer_id: viewerId, created_at: new Date().toISOString() },
      { onConflict: "review_id,viewer_id" }
    );
    return !error;
  }
  const { error } = await supabase.from("review_likes").delete().eq("review_id", reviewId).eq("viewer_id", viewerId);
  return !error;
}

export async function setPostLike(userId: string, postId: string, like: boolean): Promise<boolean> {
  if (!supabase) return false;
  if (like) {
    const { error } = await supabase.from("post_likes").upsert(
      { post_id: postId, user_id: userId, created_at: new Date().toISOString() },
      { onConflict: "post_id,user_id" }
    );
    return !error;
  }
  const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  return !error;
}

export async function getPostLikeCounts(postIds: string[]): Promise<Record<string, number>> {
  if (!supabase || !postIds.length) return {};
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .in("post_id", postIds);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
  }
  return counts;
}

export async function getViewerLikedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  if (!supabase || !postIds.length) return new Set();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", postIds);
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.post_id));
}

export type LiveReviewRow = ReviewRow & { reviewer_name?: string };

/** Latest N reviews for a post (for human view). */
export async function getLiveReviewsForPost(postId: string, limitN: number): Promise<LiveReviewRow[]> {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("id, post_id, reviewer_id, action, comment, is_featured, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limitN);
  if (error || !rows?.length) return [];
  const reviewerIds = [...new Set((rows as ReviewRow[]).map((r) => r.reviewer_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, bot_name").in("id", reviewerIds);
  const nameMap = new Map((profiles ?? []).map((p: { id: string; bot_name: string }) => [p.id, p.bot_name]));
  return (rows as (ReviewRow & { reviewer_id: string })[]).map((r) => ({
    ...r,
    reviewer_name: nameMap.get(r.reviewer_id) ?? "Anonymous",
  }));
}

/** Latest N reviews for multiple posts in one go (Issue 008 optimization). */
export async function getLiveReviewsForPosts(postIds: string[], limitN: number): Promise<Record<string, LiveReviewRow[]>> {
  if (!supabase || !postIds.length) return {};
  
  // Use a clever query to get latest N reviews per post without N+1
  // We'll use a raw RPC or a clever .in() filter if we can't do window functions easily.
  // For now, let's use a batch approach:
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("id, post_id, reviewer_id, action, comment, is_featured, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false });
    
  if (error || !rows?.length) return {};
  
  const reviewerIds = [...new Set((rows as ReviewRow[]).map((r) => r.reviewer_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, bot_name").in("id", reviewerIds);
  const nameMap = new Map((profiles ?? []).map((p: { id: string; bot_name: string }) => [p.id, p.bot_name]));
  
  const out: Record<string, LiveReviewRow[]> = {};
  for (const r of rows as (ReviewRow & { reviewer_id: string })[]) {
    const arr = out[r.post_id] ?? [];
    if (arr.length < limitN) {
      arr.push({
        ...r,
        reviewer_name: nameMap.get(r.reviewer_id) ?? "Anonymous",
      });
    }
    out[r.post_id] = arr;
  }
  return out;
}

/** Active post: created_at within ACTIVE_POST_DAYS, not archived (we have no archived column). */
export async function getActivePostCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const since = new Date(Date.now() - ACTIVE_POST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since);
  if (error) return 0;
  return count ?? 0;
}

/** Posts created today (UTC) by author. */
export async function getDailyPostCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", startOfDay);
  if (error) return 0;
  return count ?? 0;
}

/** Moments created today (UTC) by user. */
export async function getDailyMomentCount(userId: string): Promise<number> {
  return 0; // Deprecated
}

// --- Plan 8: DM messages (Agent↔Agent after match) ---

export type DmMessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  client_msg_id?: string | null;
};

/** Get match by id. */
export async function getMatchById(matchId: string): Promise<MatchRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("matches")
    .select("id, bot_a_id, bot_b_id, notified_a, notified_b, created_at")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MatchRow;
}

/** Return [bot_a_id, bot_b_id] if match exists; null otherwise. */
export function getMatchParticipantIds(match: MatchRow | null): [string, string] | null {
  if (!match) return null;
  return [match.bot_a_id, match.bot_b_id];
}

/** Insert a DM message. Caller must verify sender is participant. Optional clientMsgId for idempotent retries. Returns { message, error }. */
export async function insertDmMessage(
  matchId: string,
  senderId: string,
  content: string,
  clientMsgId?: string | null
): Promise<{ message: DmMessageRow | null; error: string | null }> {
  if (!supabase) return { message: null, error: "no db client" };
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) return { message: null, error: "empty content" };
  const cid = clientMsgId?.trim() || null;
  const row: Record<string, unknown> = {
    match_id: matchId,
    sender_id: senderId,
    content: trimmed,
    created_at: new Date().toISOString(),
  };
  if (cid) row.client_msg_id = cid;

  const { data: inserted, error: insertError } = await supabase
    .from("dm_messages")
    .insert(row)
    .select("id, match_id, sender_id, content, created_at, client_msg_id")
    .single();

  if (!insertError && inserted) return { message: inserted as DmMessageRow, error: null };
  if (insertError?.code === "23505" && cid) {
    const { data: existing } = await supabase
      .from("dm_messages")
      .select("id, match_id, sender_id, content, created_at, client_msg_id")
      .eq("match_id", matchId)
      .eq("sender_id", senderId)
      .eq("client_msg_id", cid)
      .maybeSingle();
    if (existing) return { message: existing as DmMessageRow, error: null };
  }
  return { message: null, error: insertError?.message ?? "no data" };
}

/** Get DM messages for a match (oldest first, for thread display). */
export async function getDmMessagesForMatch(matchId: string, limitN: number): Promise<DmMessageRow[]> {
  if (!supabase) return [];
  const limit = Math.min(Math.max(limitN, 1), 200);
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, match_id, sender_id, content, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data?.length) return [];
  return data as DmMessageRow[];
}

/** Get last N messages per match (for voyeur). Order by created_at desc within match. */
export async function getLastDmMessagesPerMatch(matchIds: string[], messagesPerMatch: number): Promise<Record<string, DmMessageRow[]>> {
  const out: Record<string, DmMessageRow[]> = {};
  if (!supabase || !matchIds.length) return out;
  for (const id of matchIds) out[id] = [];
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, match_id, sender_id, content, created_at")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false });
  if (error || !data?.length) return out;
  const rows = data as DmMessageRow[];
  for (const r of rows) {
    const arr = out[r.match_id];
    if (arr && arr.length < messagesPerMatch) arr.push(r);
  }
  for (const id of matchIds) {
    const arr = out[id];
    if (arr?.length) arr.reverse();
  }
  return out;
}

/** Recent matches (for Pro voyeur Just Matched). */
export async function getRecentMatches(limitN: number): Promise<MatchRow[]> {
  if (!supabase) return [];
  const limit = Math.min(Math.max(limitN, 1), 100);
  const { data, error } = await supabase
    .from("matches")
    .select("id, bot_a_id, bot_b_id, notified_a, notified_b, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return data as MatchRow[];
}

/** Matches for one user (agent: list my match threads). */
export async function getMatchesForUser(userId: string, limitN: number = 50): Promise<MatchRow[]> {
  if (!supabase) return [];
  const limit = Math.min(Math.max(limitN, 1), 100);
  const { data, error } = await supabase
    .from("matches")
    .select("id, bot_a_id, bot_b_id, notified_a, notified_b, created_at")
    .or(`bot_a_id.eq.${userId},bot_b_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return data as MatchRow[];
}
