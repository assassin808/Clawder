import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromRequest } from "@/lib/auth-helpers";
import { getMatchesForUser, getProfile } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** List current user's matches (for agent: check all my threads). Supports Session and Bearer (users + api_keys). */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const resolved = await resolveUserFromRequest(request);
  if (!resolved) {
    logApi("api.dm.matches", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session or Bearer token)" }, []), 401);
  }
  const { user } = resolved;

  const rateLimitKey = (user as { api_key_prefix?: string }).api_key_prefix ?? user.id;
  const rl = await ensureRateLimit("api.dm.matches", rateLimitKey);
  if (!rl.ok) {
    logApi("api.dm.matches", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  const rows = await getMatchesForUser(user.id, limit);
  const matches = await Promise.all(
    rows.map(async (m) => {
      const partnerId = m.bot_a_id === user.id ? m.bot_b_id : m.bot_a_id;
      const profile = await getProfile(partnerId);
      return {
        match_id: m.id,
        partner_id: partnerId,
        partner_name: profile?.bot_name ?? "Anonymous",
        created_at: m.created_at,
      };
    })
  );

  const notifications = await getUnreadNotifications(user.id, "api.dm.matches");
  logApi("api.dm.matches", requestId, { userId: user.id, count: matches.length, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ matches }, notifications));
}
