import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import type { NotificationItem } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  supabase,
  upsertInteraction,
  getLikersOf,
  ensureMatch,
  getProfile,
  getPostById,
  upsertReview,
  upsertPostInteraction,
  updatePostCounters,
  getLikersOfAuthorByPosts,
} from "@/lib/db";
import { getUnreadNotifications, enqueueNotification } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";
import { recalculateResonanceScores } from "@/lib/resonance-scorer";
import { isProTier } from "@/lib/api";

const COMMENT_MIN_LEN = 5;
const COMMENT_MAX_LEN = 300;
const DISABLE_LIMITS = process.env.DISABLE_LIMITS === "1";
const DAILY_SWIPES_FREE = Number(process.env.DAILY_SWIPES_FREE) || 200;
const DAILY_SWIPES_PRO = Number(process.env.DAILY_SWIPES_PRO) || 400; // 2× free

async function getSwipeCountToday(userId: string): Promise<number> {
  // Lazy daily quota without schema changes: count swipes since UTC midnight across both tables.
  // Note: Supabase stores timestamptz; using UTC day boundary is good enough for MVP.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();
  if (!supabase) return 0;
  const [postRes, legacyRes] = await Promise.all([
    supabase.from("post_interactions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("from_id", userId).gte("created_at", since),
  ]);
  const a = postRes.count ?? 0;
  const b = legacyRes.count ?? 0;
  return a + b;
}

type PostDecision = { post_id: string; action: "like" | "pass"; comment: string; block_author?: boolean };
type LegacyDecision = { target_id: string; action: "like" | "pass"; reason?: string };

function isPostDecision(d: unknown): d is PostDecision {
  return (
    typeof (d as PostDecision)?.post_id === "string" &&
    ((d as PostDecision).action === "like" || (d as PostDecision).action === "pass") &&
    typeof (d as PostDecision).comment === "string"
  );
}

/** Issue 007: comment required, 5–300 chars, no all-whitespace; returns normalized comment or error. */
function normalizeComment(raw: string): { ok: true; comment: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length < COMMENT_MIN_LEN) {
    return { ok: false, error: `comment must be at least ${COMMENT_MIN_LEN} characters (after trim)` };
  }
  const comment = trimmed.slice(0, COMMENT_MAX_LEN);
  return { ok: true, comment };
}

function isLegacyDecision(d: unknown): d is LegacyDecision {
  return (
    typeof (d as LegacyDecision)?.target_id === "string" &&
    ((d as LegacyDecision).action === "like" || (d as LegacyDecision).action === "pass")
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.swipe", user.api_key_prefix);
  if (!rl.ok) return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);

  const body = await request.json().catch(() => ({}));
  const decisions = body?.decisions as unknown[] | undefined;
  if (!Array.isArray(decisions) || !decisions.length) {
    return json(apiJson({ error: "decisions array required" }, []), 400);
  }

  const allPost = decisions.every(isPostDecision);
  const allLegacy = decisions.every(isLegacyDecision);

  if (allPost) {
    const commentsOk = (decisions as PostDecision[]).every((d) => normalizeComment(d.comment).ok);
    if (!commentsOk) {
      const firstBad = (decisions as PostDecision[]).find((d) => !normalizeComment(d.comment).ok);
      const res = firstBad ? normalizeComment(firstBad.comment) : null;
      return json(
        apiJson(
          { error: res && !res.ok ? res.error : "comment required, 5–300 chars, no all-whitespace", processed: 0, new_matches: [] },
          []
        ),
        400
      );
    }
    return handlePostLevelSwipe(requestId, start, user, decisions as PostDecision[]);
  }
  if (allLegacy) {
    return handleLegacySwipe(requestId, start, user, decisions as LegacyDecision[]);
  }
  return json(
    apiJson(
      { error: "each decision must have post_id, action (like|pass), and comment; or target_id and action for legacy" },
      []
    ),
    400
  );
}

async function handlePostLevelSwipe(
  requestId: string,
  start: number,
  user: { id: string; tier: string },
  decisions: PostDecision[]
) {
  const freeTier = !isProTier(user.tier);
  const dailyCap = freeTier ? DAILY_SWIPES_FREE : DAILY_SWIPES_PRO;
  if (!DISABLE_LIMITS) {
    const used = await getSwipeCountToday(user.id);
    if (used + decisions.length > dailyCap) {
    const notifications: NotificationItem[] = [
      {
        id: crypto.randomUUID(),
        type: "quota.exhausted",
        ts: new Date().toISOString(),
        severity: "warn",
        dedupe_key: `quota:${user.id}:${Date.now()}`,
        source: "api.swipe",
        payload: {},
      },
    ];
      return json(apiJson({ error: "daily swipe quota exceeded", limit: dailyCap, processed: 0, new_matches: [] }, notifications), 429);
    }
  }

  // Batch fetch all posts and likers upfront
  const [likersOfMeByPosts, postsById] = await Promise.all([
    getLikersOfAuthorByPosts(user.id).then(arr => new Set(arr)),
    Promise.all(decisions.map(d => getPostById(d.post_id))).then(posts => {
      const map = new Map<string, NonNullable<Awaited<ReturnType<typeof getPostById>>>>();
      posts.forEach(p => { if (p) map.set(p.id, p); });
      return map;
    })
  ]);

  const matchedPartnerIds = new Set<string>();
  
  // Process all decisions in parallel batches
  const reviewOps = [];
  const interactionOps = [];
  const counterOps = [];
  const notificationOps = [];
  const matchOps = [];

  for (const d of decisions) {
    const norm = normalizeComment(d.comment);
    const comment = norm.ok ? norm.comment : "";
    const post = postsById.get(d.post_id);
    if (!post) continue;
    
    const authorId = post.author_id;
    const action = d.action;
    const blockAuthor = !!d.block_author;

    reviewOps.push(upsertReview(post.id, user.id, action, comment));
    interactionOps.push(upsertPostInteraction(user.id, post.id, authorId, action, comment || null, blockAuthor));
    counterOps.push(updatePostCounters(post.id));
    notificationOps.push(enqueueNotification(post.author_id, {
      type: "review.created",
      source: "api.swipe",
      dedupe_key: `review:${post.id}:${user.id}`,
      payload: {
        post_id: post.id,
        reviewer_id: user.id,
        action,
        comment: comment || "",
        created_at: new Date().toISOString(),
      },
    }));

    if (action === "like" && likersOfMeByPosts.has(authorId)) {
      matchOps.push(ensureMatch(user.id, authorId));
      matchedPartnerIds.add(authorId);
    }
  }

  // Execute all operations in parallel
  await Promise.all([
    ...reviewOps,
    ...interactionOps,
    ...counterOps,
    ...notificationOps,
    ...matchOps
  ]);

  if (matchedPartnerIds.size > 0) {
    recalculateResonanceScores().catch((err) => {
      console.error("[swipe] Failed to recalc resonance scores:", err);
    });
  }

  // Batch fetch all matched partner profiles
  const profiles = await Promise.all(
    Array.from(matchedPartnerIds).map(partnerId => getProfile(partnerId))
  );
  const newMatches = Array.from(matchedPartnerIds).map((partnerId, idx) => ({
    partner_id: partnerId,
    partner_name: profiles[idx]?.bot_name ?? "",
    contact: profiles[idx]?.contact ?? "",
  }));

  const notifications = await getUnreadNotifications(user.id, "api.swipe");
  logApi("api.swipe", requestId, {
    userId: user.id,
    durationMs: Date.now() - start,
    status: 200,
    processed: decisions.length,
    newMatches: newMatches.length,
  });
  return json(apiJson({ processed: decisions.length, new_matches: newMatches }, notifications));
}

async function handleLegacySwipe(
  requestId: string,
  start: number,
  user: { id: string; tier: string },
  decisions: LegacyDecision[]
) {
  const freeTier = !isProTier(user.tier);
  const dailyCap = freeTier ? DAILY_SWIPES_FREE : DAILY_SWIPES_PRO;
  if (!DISABLE_LIMITS) {
    const used = await getSwipeCountToday(user.id);
    if (used + decisions.length > dailyCap) {
    const notifications: NotificationItem[] = [
      {
        id: crypto.randomUUID(),
        type: "quota.exhausted",
        ts: new Date().toISOString(),
        severity: "warn",
        dedupe_key: `quota:${user.id}:${Date.now()}`,
        source: "api.swipe",
        payload: {},
      },
    ];
      return json(apiJson({ error: "daily swipe quota exceeded", limit: dailyCap, processed: 0, new_matches: [] }, notifications), 429);
    }
  }

  const likersOfMe = await getLikersOf(user.id);

  // Process all interactions in parallel
  const interactionOps = decisions.map(d => 
    upsertInteraction(user.id, d.target_id, d.action as "like" | "pass", d.reason ?? null)
  );
  
  const mutualTargets = decisions.filter((d) => d.action === "like" && likersOfMe.includes(d.target_id));
  const matchOps = mutualTargets.map(d => ensureMatch(user.id, d.target_id));
  
  await Promise.all([...interactionOps, ...matchOps]);

  if (mutualTargets.length > 0) {
    recalculateResonanceScores().catch((err) => {
      console.error("[swipe] Failed to recalc resonance scores:", err);
    });
  }

  // Batch fetch all matched profiles
  const profiles = await Promise.all(
    mutualTargets.map(d => getProfile(d.target_id))
  );
  const newMatches = mutualTargets.map((d, idx) => ({
    partner_id: d.target_id,
    partner_name: profiles[idx]?.bot_name ?? "",
    contact: profiles[idx]?.contact ?? "",
  }));

  const notifications = await getUnreadNotifications(user.id, "api.swipe");
  logApi("api.swipe", requestId, {
    userId: user.id,
    durationMs: Date.now() - start,
    status: 200,
    processed: decisions.length,
    newMatches: newMatches.length,
  });
  return json(apiJson({ processed: decisions.length, new_matches: newMatches }, notifications));
}
