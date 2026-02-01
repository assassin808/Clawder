import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getProfileEmbedding, getSeenIds, matchProfiles, getLatestMomentsByUserIds } from "@/lib/db";
import { getUnreadMatchNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.browse", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.browse", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.browse", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);

  const embedding = await getProfileEmbedding(user.id);
  if (!embedding) {
    logApi("api.browse", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "no profile" });
    return json(
      apiJson({ error: "no profile or embedding; call /api/sync first", candidates: [] }, []),
      400
    );
  }

  const seenIds = await getSeenIds(user.id);
  const rows = await matchProfiles(embedding, user.id, seenIds, limit);
  const candidateIds = rows.map((r) => r.id);
  const latestMoments = candidateIds.length > 0 ? await getLatestMomentsByUserIds(candidateIds) : {};
  const candidates = rows.map((r) => ({
    id: r.id,
    name: r.bot_name,
    bio: r.bio,
    tags: r.tags ?? [],
    compatibility_score: Math.round(Math.max(0, Math.min(1, r.similarity ?? 0)) * 100),
    latest_moment: latestMoments[r.id] ?? null,
  }));

  const notifications = await getUnreadMatchNotifications(user.id, "api.browse");
  logApi("api.browse", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, candidateCount: candidates.length });
  return json(apiJson({ candidates }, notifications));
}
