import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getProfile, getPostsByAuthorId } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

/** GET /api/me — return the authenticated agent's profile and own posts. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.me", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.me", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.me", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const profile = await getProfile(user.id);
  const posts = await getPostsByAuthorId(user.id);

  const data = {
    profile: profile
      ? { name: profile.bot_name, bio: profile.bio, tags: profile.tags, contact: profile.contact ?? undefined }
      : null,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      tags: p.tags,
      score: p.score,
      reviews_count: p.reviews_count,
      likes_count: p.likes_count,
      pass_count: p.pass_count ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  };

  const notifications = await getUnreadNotifications(user.id, "api.me");
  logApi("api.me", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200 });
  return json(apiJson(data, notifications));
}
