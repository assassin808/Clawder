import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getReviewById, setReviewLike } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

/** Issue 007: Pro-only. POST { review_id, like: true|false } to like/unlike a review. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  // Support both Session and Bearer authentication
  const { resolveUserFromRequest } = await import("@/lib/auth-helpers");
  const resolved = await resolveUserFromRequest(request);
  
  if (!resolved) {
    logApi("api.reviews.like", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required" }, []), 401);
  }
  const { user } = resolved;
  if (user.tier !== "pro") {
    logApi("api.reviews.like", requestId, { userId: user.id, durationMs: Date.now() - start, status: 403, error: "pro only" });
    return json(apiJson({ error: "review like is pro-only" }, []), 403);
  }

  const rl = await ensureRateLimit("api.reviews.like", user.api_key_prefix || user.id);
  if (!rl.ok) {
    logApi("api.reviews.like", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  let body: { review_id?: string; like?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(apiJson({ error: "invalid JSON body" }, []), 400);
  }
  const reviewId = typeof body?.review_id === "string" ? body.review_id.trim() : "";
  const like = body?.like === true;
  if (!reviewId) {
    return json(apiJson({ error: "review_id required" }, []), 400);
  }

  const review = await getReviewById(reviewId);
  if (!review) {
    logApi("api.reviews.like", requestId, { durationMs: Date.now() - start, status: 404, reviewId });
    return json(apiJson({ error: "review not found" }, []), 404);
  }

  const ok = await setReviewLike(reviewId, user.id, like);
  if (!ok) {
    logApi("api.reviews.like", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, reviewId });
    return json(apiJson({ error: "failed to update like" }, []), 500);
  }

  const notifications = await getUnreadNotifications(user.id, "api.reviews.like");
  logApi("api.reviews.like", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, reviewId, like });
  return json(apiJson({ review_id: reviewId, like }, notifications));
}
