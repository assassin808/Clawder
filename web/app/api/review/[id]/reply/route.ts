import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getReviewById,
  getPostById,
  upsertReviewReply,
} from "@/lib/db";
import { getUnreadNotifications, enqueueNotification } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const COMMENT_MIN_LEN = 1;
const COMMENT_MAX_LEN = 300;

function normalizeComment(raw: string): { ok: true; comment: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length < COMMENT_MIN_LEN) {
    return { ok: false, error: `comment must be at least ${COMMENT_MIN_LEN} character(s) after trim` };
  }
  const comment = trimmed.slice(0, COMMENT_MAX_LEN);
  return { ok: true, comment };
}

/** Plan 7: Post author replies once to a review. Bearer required. Reviewer receives review_reply.created. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.review.reply", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.review.reply", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.review.reply", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { id: reviewId } = await params;
  if (!reviewId) {
    return json(apiJson({ error: "review id required" }, []), 400);
  }

  const body = await request.json().catch(() => ({}));
  const rawComment = body?.comment as string | undefined;
  if (rawComment === undefined) {
    return json(apiJson({ error: "comment required" }, []), 400);
  }
  const norm = normalizeComment(typeof rawComment === "string" ? rawComment : "");
  if (!norm.ok) {
    return json(apiJson({ error: norm.error }, []), 400);
  }

  const review = await getReviewById(reviewId);
  if (!review) {
    logApi("api.review.reply", requestId, { durationMs: Date.now() - start, status: 404, reviewId });
    return json(apiJson({ error: "review not found" }, []), 404);
  }

  const post = await getPostById(review.post_id);
  if (!post) {
    return json(apiJson({ error: "post not found" }, []), 404);
  }
  if (post.author_id !== user.id) {
    logApi("api.review.reply", requestId, { userId: user.id, postAuthorId: post.author_id, durationMs: Date.now() - start, status: 403 });
    return json(apiJson({ error: "only the post author may reply to this review" }, []), 403);
  }

  const reply = await upsertReviewReply(reviewId, user.id, norm.comment);
  if (!reply) {
    logApi("api.review.reply", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "upsert failed" });
    return json(apiJson({ error: "reply failed" }, []), 500);
  }

  await enqueueNotification(review.reviewer_id, {
    type: "review_reply.created",
    source: "api.review.reply",
    dedupe_key: `review_reply:${reviewId}`,
    payload: {
      review_id: reviewId,
      post_id: review.post_id,
      replier_id: user.id,
      comment: reply.comment,
      created_at: reply.created_at,
    },
  });

  const notifications = await getUnreadNotifications(user.id, "api.review.reply");
  logApi("api.review.reply", requestId, { userId: user.id, reviewId, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ status: "ok", id: reply.id }, notifications));
}
