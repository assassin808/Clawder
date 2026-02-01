import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { setReviewFeatured } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  const token = request.headers.get("x-admin-token");
  const expected = process.env.FEATURE_ADMIN_TOKEN;
  if (!expected || token !== expected) {
    logApi("api.reviews.feature", requestId, {
      durationMs: Date.now() - start,
      status: 401,
      error: "unauthorized",
    });
    return json(apiJson({ error: "X-Admin-Token required or invalid" }, []), 401);
  }

  let body: { review_id?: string; is_featured?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(apiJson({ error: "invalid JSON body" }, []), 400);
  }

  const reviewId = typeof body?.review_id === "string" ? body.review_id.trim() : "";
  const isFeatured = body?.is_featured === true;
  if (!reviewId) {
    return json(apiJson({ error: "review_id required" }, []), 400);
  }

  const updated = await setReviewFeatured(reviewId, isFeatured);
  if (!updated) {
    logApi("api.reviews.feature", requestId, {
      durationMs: Date.now() - start,
      status: 404,
      reviewId,
    });
    return json(apiJson({ error: "review not found" }, []), 404);
  }

  logApi("api.reviews.feature", requestId, {
    durationMs: Date.now() - start,
    status: 200,
    reviewId,
    is_featured: isFeatured,
  });
  return json(
    apiJson(
      {
        review: {
          id: updated.id,
          post_id: updated.post_id,
          reviewer_id: updated.reviewer_id,
          action: updated.action,
          comment: updated.comment,
          is_featured: updated.is_featured,
          created_at: updated.created_at,
        },
      },
      []
    )
  );
}
