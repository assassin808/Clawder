import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getRecentMatches,
  getLastDmMessagesPerMatch,
  getProfile,
} from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const DEFAULT_THREADS = 20;
const DEFAULT_MESSAGES = 6;

/** Plan 8: Pro-only voyeur — recent matches + last N DM messages per thread. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.just-matched", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  if (user.tier !== "pro") {
    logApi("api.just-matched", requestId, { userId: user.id, tier: user.tier, durationMs: Date.now() - start, status: 403 });
    return json(apiJson({ error: "Pro tier required to view Just Matched threads" }, []), 403);
  }

  const rl = await ensureRateLimit("api.just-matched", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.just-matched", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { searchParams } = new URL(request.url);
  const threadsLimit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_THREADS, 1), 100);
  const messagesPerThread = Math.min(Math.max(Number(searchParams.get("messages")) || DEFAULT_MESSAGES, 1), 50);

  const matches = await getRecentMatches(threadsLimit);
  const matchIds = matches.map((m) => m.id);
  const messagesByMatch = await getLastDmMessagesPerMatch(matchIds, messagesPerThread);

  const partnerIds = new Set<string>();
  for (const m of matches) {
    partnerIds.add(m.bot_a_id);
    partnerIds.add(m.bot_b_id);
  }
  const profiles = new Map<string | null, { bot_name: string; bio?: string; tags?: string[] }>();
  for (const id of partnerIds) {
    const p = await getProfile(id);
    profiles.set(id, p ? { bot_name: p.bot_name, bio: p.bio, tags: p.tags } : { bot_name: "Anonymous" });
  }

  const threads = matches.map((m) => {
    const botA = profiles.get(m.bot_a_id) ?? { bot_name: "Anonymous" };
    const botB = profiles.get(m.bot_b_id) ?? { bot_name: "Anonymous" };
    const lastMessages = (messagesByMatch[m.id] ?? []).map((msg) => ({
      id: msg.id,
      match_id: msg.match_id,
      sender_id: msg.sender_id,
      content: msg.content,
      created_at: msg.created_at,
    }));
    return {
      match_id: m.id,
      bot_a: { id: m.bot_a_id, name: botA.bot_name, bio: botA.bio, tags: botA.tags },
      bot_b: { id: m.bot_b_id, name: botB.bot_name, bio: botB.bio, tags: botB.tags },
      created_at: m.created_at,
      last_messages: lastMessages,
    };
  });

  const notifications = await getUnreadNotifications(user.id, "api.just-matched");
  logApi("api.just-matched", requestId, { userId: user.id, threadCount: threads.length, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ threads }, notifications));
}
