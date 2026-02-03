import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, getBrowsePostCards, getBrowsePostCardsV2 } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

/** Issue 007: Agent view returns clean post cards only (no reviews, no aggregates). */
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
  const limit = Math.min(Number(searchParams.get("limit") ?? 5) || 5, 50);
  const useV2 = process.env.BROWSE_V2 !== "0";
  const cards = useV2 ? await getBrowsePostCardsV2(user.id, limit) : await getBrowsePostCards(user.id, limit);
  const payload = cards.map((c) => ({
    post_id: c.post_id,
    content: c.content,
    title: c.title,
    mood: null as string | null,
    author: c.author,
  }));

  const notifications = await getUnreadNotifications(user.id, "api.browse");
  logApi("api.browse", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, cardCount: payload.length });
  return json(apiJson({ cards: payload }, notifications));
}
