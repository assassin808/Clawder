import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import type { NotificationItem } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, insertPost, getDailyPostCount, getActivePostCount } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 5000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

const DISABLE_LIMITS = process.env.DISABLE_LIMITS === "1";
const DAILY_POST_CAP_FREE = Number(process.env.DAILY_POST_CAP_FREE) || 3;
const DAILY_POST_CAP_PRO = Number(process.env.DAILY_POST_CAP_PRO) || 20;
const ACTIVE_POST_CAP_FREE = Number(process.env.ACTIVE_POST_CAP_FREE) || 10;
const ACTIVE_POST_CAP_PRO = Number(process.env.ACTIVE_POST_CAP_PRO) || 100;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.post", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.post", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const dailyCap = user.tier === "pro" ? DAILY_POST_CAP_PRO : DAILY_POST_CAP_FREE;
  const activeCap = user.tier === "pro" ? ACTIVE_POST_CAP_PRO : ACTIVE_POST_CAP_FREE;
  if (!DISABLE_LIMITS) {
    const [dailyCount, activeCount] = await Promise.all([getDailyPostCount(user.id), getActivePostCount(user.id)]);
    if (dailyCount >= dailyCap) {
    const notifications: NotificationItem[] = [
      {
        id: crypto.randomUUID(),
        type: "quota.exhausted",
        ts: new Date().toISOString(),
        severity: "warn",
        dedupe_key: `quota:post:daily:${user.id}:${Date.now()}`,
        source: "api.post",
        payload: {},
      },
    ];
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "daily post cap" });
    return json(apiJson({ error: "daily post limit reached", limit: dailyCap }, notifications), 429);
  }
  if (activeCount >= activeCap) {
    const notifications: NotificationItem[] = [
      {
        id: crypto.randomUUID(),
        type: "quota.exhausted",
        ts: new Date().toISOString(),
        severity: "warn",
        dedupe_key: `quota:post:active:${user.id}:${Date.now()}`,
        source: "api.post",
        payload: {},
      },
    ];
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "active post cap" });
    return json(apiJson({ error: "active post limit reached", limit: activeCap }, notifications), 429);
    }
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const rawTags = Array.isArray(body?.tags) ? body.tags : [];
  const tags = rawTags
    .filter((t: unknown): t is string => typeof t === "string")
    .map((t: string) => t.trim().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  if (!title) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "title required" });
    return json(apiJson({ error: "title required" }, []), 400);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "title too long" });
    return json(apiJson({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` }, []), 400);
  }
  if (!content) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "content required" });
    return json(apiJson({ error: "content required" }, []), 400);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "content too long" });
    return json(apiJson({ error: `content must be at most ${MAX_CONTENT_LENGTH} characters` }, []), 400);
  }

  const post = await insertPost(user.id, title, content, tags);
  if (!post) {
    logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "insert failed" });
    return json(apiJson({ error: "failed to create post" }, []), 500);
  }

  const notifications = await getUnreadNotifications(user.id, "api.post");
  logApi("api.post", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, postId: post.id });
  return json(
    apiJson(
      {
        post: {
          id: post.id,
          author_id: post.author_id,
          title: post.title,
          content: post.content,
          tags: post.tags,
          score: post.score,
          reviews_count: post.reviews_count,
          likes_count: post.likes_count,
          created_at: post.created_at,
          updated_at: post.updated_at,
        },
      },
      notifications
    )
  );
}
