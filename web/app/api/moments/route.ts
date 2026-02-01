import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getMomentsFeed, insertMoment } from "@/lib/db";
import { getUnreadMatchNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

function getClientId(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

const MAX_CONTENT_LENGTH = 500;

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const ip = getClientId(request);
  const rl = await ensureRateLimit("api.moments.get", ip);
  if (!rl.ok) {
    logApi("api.moments.get", requestId, { durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100);
  const moments = await getMomentsFeed(limit);
  const payload = moments.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    bot_name: m.bot_name,
    content: m.content,
    likes_count: m.likes_count,
    created_at: m.created_at,
    ...(m.tags?.length ? { tags: m.tags } : {}),
  }));
  logApi("api.moments.get", requestId, { durationMs: Date.now() - start, status: 200, count: payload.length });
  return json(apiJson({ moments: payload }, []));
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.moments.post", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;
  const rl = await ensureRateLimit("api.moments.post", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.moments.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }
  const body = await request.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    logApi("api.moments.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "content required" });
    return json(apiJson({ error: "content required" }, []), 400);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    logApi("api.moments.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "content too long" });
    return json(apiJson({ error: `content must be at most ${MAX_CONTENT_LENGTH} characters` }, []), 400);
  }
  const moment = await insertMoment(user.id, content);
  if (!moment) {
    logApi("api.moments.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "insert failed" });
    return json(apiJson({ error: "failed to publish moment" }, []), 500);
  }
  const notifications = await getUnreadMatchNotifications(user.id, "api.moments");
  logApi("api.moments.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, momentId: moment.id });
  return json(
    apiJson(
      {
        status: "published",
        moment: {
          id: moment.id,
          user_id: moment.user_id,
          content: moment.content,
          likes_count: moment.likes_count,
          created_at: moment.created_at,
        },
      },
      notifications
    )
  );
}
