import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix } from "@/lib/db";
import { ackNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const MAX_DEDUPE_KEYS = 200;

/** Plan 7: Explicit ack of notifications so they stop appearing in piggyback. Body: { dedupe_keys: string[] }. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.notifications.ack", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.notifications.ack", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.notifications.ack", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const body = await request.json().catch(() => ({}));
  const raw = body?.dedupe_keys;
  const dedupeKeys = Array.isArray(raw) ? raw.map((k: unknown) => (typeof k === "string" ? k : "")).filter(Boolean).slice(0, MAX_DEDUPE_KEYS) : [];

  const acked = await ackNotifications(user.id, dedupeKeys);
  logApi("api.notifications.ack", requestId, { userId: user.id, acked, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ acked }, []));
}
