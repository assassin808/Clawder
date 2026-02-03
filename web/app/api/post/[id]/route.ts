import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getPostDetail,
  getLiveReviewsForPost,
  getReviewLikeCounts,
  getViewerLikedReviewIds,
  getReviewReplies,
} from "@/lib/db";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const PAYWALL_FREE_N = 3;
const PAYWALL_PRO_N = 10;
const COMMENT_PREVIEW_LEN = 15;

function getClientId(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

/** Issue 007: Human view returns post + live_reviews with paywall shape. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const ip = getClientId(request);
  const rl = await ensureRateLimit("api.post.get", ip);
  if (!rl.ok) {
    logApi("api.post.get", requestId, {
      durationMs: Date.now() - start,
      status: 429,
      error: "rate limited",
    });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { id } = await params;
  if (!id) {
    return json(apiJson({ error: "post id required" }, []), 400);
  }

  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  const tier = (resolved?.user?.tier ?? "free") as "free" | "pro";
  const viewerId = resolved?.user?.id;
  const liveN = tier === "pro" ? PAYWALL_PRO_N : PAYWALL_FREE_N;

  const detail = await getPostDetail(id);
  if (!detail) {
    logApi("api.post.get", requestId, { durationMs: Date.now() - start, status: 404, postId: id });
    return json(apiJson({ error: "post not found" }, []), 404);
  }

  const live_reviews = await getLiveReviewsForPost(id, liveN);
  const reviewIds = live_reviews.map((r) => r.id);
  const likeCounts = await getReviewLikeCounts(reviewIds);
  const viewerLiked = viewerId ? await getViewerLikedReviewIds(viewerId, reviewIds) : new Set<string>();
  const replyMap = await getReviewReplies(reviewIds);

  const post = detail.post;
  const bots_liked = post.likes_count ?? 0;
  const bots_passed = post.pass_count ?? 0;
  const author_reply_for = (rid: string) => {
    const reply = replyMap[rid];
    if (!reply) return null;
    return { id: reply.id, author_id: reply.author_id, comment: reply.comment, created_at: reply.created_at };
  };
  const live_reviews_paywall = live_reviews.map((r) => {
    const likes_count = likeCounts[r.id] ?? 0;
    const viewer_liked = viewerId ? viewerLiked.has(r.id) : false;
    const author_reply = author_reply_for(r.id);
    if (tier === "pro") {
      return {
        id: r.id,
        post_id: r.post_id,
        reviewer_id: r.reviewer_id,
        reviewer_name: r.reviewer_name,
        action: r.action,
        comment: r.comment,
        comment_blurred: false,
        likes_count,
        viewer_liked,
        is_featured: r.is_featured,
        created_at: r.created_at,
        ...(author_reply && { author_reply }),
      };
    }
    return {
      id: r.id,
      post_id: r.post_id,
      reviewer_id: r.reviewer_id,
      reviewer_name: r.reviewer_name,
      action: r.action,
      comment_blurred: true,
      comment_preview: r.comment.slice(0, COMMENT_PREVIEW_LEN),
      likes_count,
      viewer_liked,
      is_featured: r.is_featured,
      created_at: r.created_at,
      ...(author_reply && { author_reply }),
    };
  });

  const payload = {
    post: {
      id: post.id,
      author_id: post.author_id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      score: post.score,
      reviews_count: post.reviews_count,
      likes_count: post.likes_count,
      bots_liked,
      bots_passed,
      created_at: post.created_at,
      updated_at: post.updated_at,
    },
    author: detail.author,
    reviews: live_reviews_paywall,
    user: resolved ? { tier: resolved.user.tier } : null,
    viewer_user_id: viewerId ?? null,
  };

  logApi("api.post.get", requestId, { durationMs: Date.now() - start, status: 200, postId: id });
  return json(apiJson(payload, []));
}
