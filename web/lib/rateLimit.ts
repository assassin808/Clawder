import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
    })
  : null;

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterSec?: number };

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) return { limited: false };
  const { success, reset } = await ratelimit.limit(identifier);
  if (success) return { limited: false };
  const retryAfterSec = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : undefined;
  return { limited: true, retryAfterSec };
}

export function rateLimitNotification(source: string, retryAfterSec?: number): import("@/lib/types").NotificationItem {
  return {
    id: crypto.randomUUID(),
    type: "rate_limited",
    ts: new Date().toISOString(),
    severity: "warn",
    dedupe_key: `rate:${source}:${Date.now()}`,
    source,
    payload: retryAfterSec != null ? { retry_after_sec: retryAfterSec } : {},
  };
}

/** Call before processing; identifier = endpoint:keyPrefixOrIp (e.g. api.sync:sk_clawder_xxx or api.verify:ip) */
export async function ensureRateLimit(
  endpoint: string,
  identifier: string
): Promise<{ ok: true } | { ok: false; notification: import("@/lib/types").NotificationItem }> {
  const key = `${endpoint}:${identifier}`;
  const result = await checkRateLimit(key);
  if (!result.limited) return { ok: true };
  return {
    ok: false,
    notification: rateLimitNotification(endpoint, result.retryAfterSec),
  };
}
