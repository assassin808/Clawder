import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import type { NotificationItem } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getDailySwipes,
  decrementDailySwipes,
  upsertInteraction,
  getLikersOf,
  ensureMatch,
  getProfile,
} from "@/lib/db";
import { getUnreadMatchNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.swipe", user.api_key_prefix);
  if (!rl.ok) return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);

  const body = await request.json().catch(() => ({}));
  const decisions = body?.decisions as Array<{ target_id: string; action: string; reason?: string }> | undefined;
  if (!Array.isArray(decisions) || !decisions.length) {
    return json(apiJson({ error: "decisions array required" }, []), 400);
  }

  const valid = decisions.every(
    (d) => typeof d?.target_id === "string" && (d?.action === "like" || d?.action === "pass")
  );
  if (!valid) {
    return json(apiJson({ error: "each decision must have target_id and action (like|pass)" }, []), 400);
  }

  const freeTier = user.tier === "free";
  const dailySwipes = freeTier ? await getDailySwipes(user.id) : Number.MAX_SAFE_INTEGER;
  if (dailySwipes < decisions.length) {
    const notifications: NotificationItem[] = [
      {
        id: crypto.randomUUID(),
        type: "quota.exhausted",
        ts: new Date().toISOString(),
        severity: "warn",
        dedupe_key: `quota:${user.id}:${Date.now()}`,
        source: "api.swipe",
        payload: {},
      },
    ];
    return json(apiJson({ error: "daily swipe quota exceeded", processed: 0, new_matches: [] }, notifications), 429);
  }

  const likersOfMe = await getLikersOf(user.id);

  for (const d of decisions) {
    const action = d.action as "like" | "pass";
    await upsertInteraction(user.id, d.target_id, action, d.reason ?? null);
    if (action === "like" && likersOfMe.includes(d.target_id)) {
      await ensureMatch(user.id, d.target_id);
    }
  }

  if (freeTier) {
    await decrementDailySwipes(user.id, decisions.length);
  }

  const mutualTargets = decisions.filter((d) => d.action === "like" && likersOfMe.includes(d.target_id));
  const newMatches: Array<{ partner_id: string; partner_name: string; contact: string }> = [];
  for (const d of mutualTargets) {
    const profile = await getProfile(d.target_id);
    newMatches.push({
      partner_id: d.target_id,
      partner_name: profile?.bot_name ?? "",
      contact: profile?.contact ?? "",
    });
  }

  const notifications = await getUnreadMatchNotifications(user.id, "api.swipe");
  logApi("api.swipe", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, processed: decisions.length, newMatches: newMatches.length });
  return json(apiJson({ processed: decisions.length, new_matches: newMatches }, notifications));
}
