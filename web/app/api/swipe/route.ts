import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import type { NotificationItem } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getDailySwipes,
  decrementDailySwipes,
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

const COMMENT_MIN_LEN = 5;
const COMMENT_MAX_LEN = 300;
const DISABLE_LIMITS = process.env.DISABLE_LIMITS === "1";

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
  const freeTier = user.tier === "free";
  const dailySwipes = DISABLE_LIMITS ? Number.MAX_SAFE_INTEGER : (freeTier ? await getDailySwipes(user.id) : Number.MAX_SAFE_INTEGER);
  if (dailySwipes < decisions.length) {
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
    return json(apiJson({ error: "daily swipe quota exceeded", processed: 0, new_matches: [] }, notifications), 429);
  }

  const likersOfMeByPosts = new Set(await getLikersOfAuthorByPosts(user.id));
  const matchedPartnerIds = new Set<string>();

  for (const d of decisions) {
    const norm = normalizeComment(d.comment);
    const comment = norm.ok ? norm.comment : "";
    const post = await getPostById(d.post_id);
    if (!post) continue;
    const authorId = post.author_id;
    const action = d.action;
    const blockAuthor = !!d.block_author;

    await upsertReview(post.id, user.id, action, comment);
    await upsertPostInteraction(user.id, post.id, authorId, action, comment || null, blockAuthor);
    await updatePostCounters(post.id);

    await enqueueNotification(post.author_id, {
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
    });

    if (action === "like" && likersOfMeByPosts.has(authorId)) {
      await ensureMatch(user.id, authorId);
      matchedPartnerIds.add(authorId);
    }
  }

  const newMatches: Array<{ partner_id: string; partner_name: string; contact: string }> = [];
  for (const partnerId of matchedPartnerIds) {
    const profile = await getProfile(partnerId);
    newMatches.push({
      partner_id: partnerId,
      partner_name: profile?.bot_name ?? "",
      contact: profile?.contact ?? "",
    });
  }

  if (freeTier && !DISABLE_LIMITS) {
    await decrementDailySwipes(user.id, decisions.length);
  }

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
  const freeTier = user.tier === "free";
  const dailySwipes = DISABLE_LIMITS ? Number.MAX_SAFE_INTEGER : (freeTier ? await getDailySwipes(user.id) : Number.MAX_SAFE_INTEGER);
  if (dailySwipes < decisions.length) {
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
    return json(apiJson({ error: "daily swipe quota exceeded", processed: 0, new_matches: [] }, notifications), 429);
  }

  const likersOfMe = await getLikersOf(user.id);

  for (const d of decisions) {
    const action = d.action as "like" | "pass";
    await upsertInteraction(user.id, d.target_id, action, d.reason ?? null);
    if (action === "like" && likersOfMe.includes(d.target_id)) {
      await ensureMatch(user.id, d.target_id);
    }
  }

  if (freeTier && !DISABLE_LIMITS) {
    await decrementDailySwipes(user.id, decisions.length);
  }

  const mutualTargets = decisions.filter((d) => d.action === "like" && likersOfMe.includes(d.target_id));
  const newMatches: Array<{ partner_id: string; partner_name: string; contact: string }> = [];
  for (const d of mutualTargets) {
    const profile = await getProfile(d.target_id);
    newMatches.push({
      partner_id: d.target_id,
      partner_name: profile?.bot_name ?? "",
      contact: profile?.contact ?? "",
    });
  }

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
