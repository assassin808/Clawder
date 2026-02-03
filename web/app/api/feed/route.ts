import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson, type NotificationItem } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getFeedItems,
  getLiveReviewsForPosts,
  getReviewLikeCounts,
  getViewerLikedReviewIds,
  getPostLikeCounts,
  getViewerLikedPostIds,
} from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
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

/** Issue 007: Human view returns live_reviews with paywall shape (comment_blurred, comment_preview 15 chars for free; full for pro). */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const ip = getClientId(request);
  const rl = await ensureRateLimit("api.feed", ip);
  if (!rl.ok) {
    logApi("api.feed", requestId, {
      durationMs: Date.now() - start,
      status: 429,
      error: "rate limited",
    });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const tag = searchParams.get("tag")?.trim() || undefined;

  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  /** Guest = not logged in; Free & Pro = full feed. Only Pro gets DM. */
  const tier = resolved ? (resolved.user.tier as "free" | "pro") : "guest";
  const viewerId = resolved?.user?.id;
  // Guests see 3 reviews, Free/Pro see 10
  const liveN = tier === "guest" ? PAYWALL_FREE_N : PAYWALL_PRO_N;

  let feedItems;
  let notifications: NotificationItem[] = [];

  if (resolved) {
    const { user } = resolved;
    feedItems = await getFeedItems({
      limit,
      viewerUserId: user.id,
      tag,
    });
    notifications = await getUnreadNotifications(user.id, "api.feed");
  } else {
    feedItems = await getFeedItems({ limit, tag });
  }

  const postIds = feedItems.map(item => item.post.id);
  const reviewsByPost = await getLiveReviewsForPosts(postIds, liveN);
  
  const allReviewIds: string[] = [];
  for (const pid in reviewsByPost) {
    for (const r of reviewsByPost[pid]) allReviewIds.push(r.id);
  }
  
  const reviewLikeCounts = await getReviewLikeCounts(allReviewIds);
  const viewerLikedReviews = viewerId ? await getViewerLikedReviewIds(viewerId, allReviewIds) : new Set<string>();
  
  // Get human post likes
  const postLikeCounts = await getPostLikeCounts(postIds);
  const viewerLikedPosts = viewerId ? await getViewerLikedPostIds(viewerId, postIds) : new Set<string>();

  const payload = feedItems.map((item) => {
    const post = item.post;
    const live_reviews = reviewsByPost[post.id] ?? [];
    const bots_liked = post.likes_count ?? 0;
    const bots_passed = post.pass_count ?? 0;
    const human_likes_count = postLikeCounts[post.id] ?? 0;
    const viewer_liked_post = viewerId ? viewerLikedPosts.has(post.id) : false;
    const live_reviews_paywall = live_reviews.map((r) => {
      const likes_count = reviewLikeCounts[r.id] ?? 0;
      const viewer_liked = viewerId ? viewerLikedReviews.has(r.id) : false;
      const isGuest = tier === "guest";
      return {
        id: r.id,
        post_id: r.post_id,
        reviewer_id: r.reviewer_id,
        reviewer_name: r.reviewer_name,
        action: r.action,
        ...(isGuest
          ? { comment_blurred: true, comment_preview: r.comment.slice(0, COMMENT_PREVIEW_LEN) }
          : { comment: r.comment, comment_blurred: false }),
        likes_count,
        viewer_liked,
        is_featured: r.is_featured,
        created_at: r.created_at,
      };
    });
    return {
      post: {
        id: post.id,
        author_id: post.author_id,
        title: post.title,
        content: post.content,
        tags: post.tags,
        score: post.score,
        reviews_count: post.reviews_count,
        likes_count: post.likes_count,
        human_likes_count,
        viewer_liked_post,
        bots_liked,
        bots_passed,
        created_at: post.created_at,
        updated_at: post.updated_at,
      },
      author: {
        id: item.author.id,
        name: item.author.name,
        bio: item.author.bio,
        tags: item.author.tags,
        compatibility_score: item.author.compatibility_score,
      },
      live_reviews: live_reviews_paywall,
    };
  });

  logApi("api.feed", requestId, {
    durationMs: Date.now() - start,
    status: 200,
    count: payload.length,
    authenticated: !!resolved,
  });
  
  const responseObj = json(
    apiJson(
      {
        feed_items: payload,
        user: resolved ? { tier: resolved.user.tier } : null,
        viewer_user_id: viewerId ?? null,
      },
      notifications
    )
  );
  
  // Add a short cache for better "back" navigation feel
  responseObj.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  
  return responseObj;
}
