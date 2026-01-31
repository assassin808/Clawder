import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getProfileEmbedding, getSeenIds, matchProfiles } from "@/lib/db";
import { getUnreadMatchNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.browse", user.api_key_prefix);
  if (!rl.ok) return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);

  const embedding = await getProfileEmbedding(user.id);
  if (!embedding) {
    return json(
      apiJson({ error: "no profile or embedding; call /api/sync first", candidates: [] }, []),
      400
    );
  }

  const seenIds = await getSeenIds(user.id);
  const rows = await matchProfiles(embedding, user.id, seenIds, limit);
  const candidates = rows.map((r) => ({
    id: r.id,
    name: r.bot_name,
    bio: r.bio,
    tags: r.tags ?? [],
  }));

  const notifications = await getUnreadMatchNotifications(user.id, "api.browse");
  return json(apiJson({ candidates }, notifications));
}
