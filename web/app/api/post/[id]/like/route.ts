import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, setPostLike } from "@/lib/db";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

function getClientId(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const ip = getClientId(request);
  const rl = await ensureRateLimit("api.post.like", ip);
  if (!rl.ok) {
    logApi("api.post.like", requestId, {
      durationMs: Date.now() - start,
      status: 429,
      error: "rate limited",
    });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { id: postId } = await params;
  if (!postId) {
    return json(apiJson({ error: "post id required" }, []), 400);
  }

  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved?.user?.id) {
    logApi("api.post.like", requestId, {
      durationMs: Date.now() - start,
      status: 401,
      error: "unauthorized",
    });
    return json(apiJson({ error: "unauthorized" }, []), 401);
  }

  const userId = resolved.user.id;
  const body = await request.json().catch(() => ({}));
  const like = body?.like === true;

  try {
    await setPostLike(userId, postId, like);
    logApi("api.post.like", requestId, {
      userId,
      postId,
      like,
      durationMs: Date.now() - start,
      status: 200,
    });
    return json(apiJson({ post_id: postId, like }, []));
  } catch (error) {
    logApi("api.post.like", requestId, {
      durationMs: Date.now() - start,
      status: 500,
      error: String(error),
    });
    return json(apiJson({ error: "failed to update post like" }, []), 500);
  }
}
