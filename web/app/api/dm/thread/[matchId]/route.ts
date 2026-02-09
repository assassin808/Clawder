import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getMatchById,
  getMatchParticipantIds,
  getProfile,
  getDmMessagesForMatch,
} from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";
import { isProTier } from "@/lib/api";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Plan 8: Get DM thread (Pro or participants). Pro users can view any thread, participants can view their own. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.dm.thread", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.dm.thread", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.dm.thread", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const { matchId } = await params;
  if (!matchId) {
    return json(apiJson({ error: "match_id required" }, []), 400);
  }

  const match = await getMatchById(matchId);
  const participants = getMatchParticipantIds(match);
  if (!participants) {
    logApi("api.dm.thread", requestId, { durationMs: Date.now() - start, status: 404, matchId });
    return json(apiJson({ error: "match not found" }, []), 404);
  }
  const [botA, botB] = participants;
  
  // Pro users can view any thread, participants can view their own
  const isPro = isProTier(user.tier);
  const isParticipant = user.id === botA || user.id === botB;
  
  if (!isPro && !isParticipant) {
    logApi("api.dm.thread", requestId, { userId: user.id, tier: user.tier, durationMs: Date.now() - start, status: 403 });
    return json(apiJson({ error: "Pro tier required to view this thread" }, []), 403);
  }
  
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  const messages = await getDmMessagesForMatch(matchId, limit);
  const notifications = await getUnreadNotifications(user.id, "api.dm.thread");

  // For Pro users, return both bot profiles; for participants, return partner only
  let payload;
  if (isPro && !isParticipant) {
    const [profileA, profileB] = await Promise.all([getProfile(botA), getProfile(botB)]);
    payload = {
      messages: messages.map((m) => ({
        id: m.id,
        match_id: m.match_id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
      })),
      bot_a: {
        id: botA,
        bot_name: profileA?.bot_name ?? "Anonymous",
        bio: profileA?.bio ?? "",
        tags: profileA?.tags ?? [],
      },
      bot_b: {
        id: botB,
        bot_name: profileB?.bot_name ?? "Anonymous",
        bio: profileB?.bio ?? "",
        tags: profileB?.tags ?? [],
      },
    };
  } else {
    // Participant viewing their own thread
    const partnerId = user.id === botA ? botB : botA;
    const profile = await getProfile(partnerId);
    payload = {
      messages: messages.map((m) => ({
        id: m.id,
        match_id: m.match_id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
      })),
      partner: {
        id: partnerId,
        bot_name: profile?.bot_name ?? "Anonymous",
        bio: profile?.bio ?? "",
        tags: profile?.tags ?? [],
      },
    };
  }

  logApi("api.dm.thread", requestId, { userId: user.id, matchId, messageCount: messages.length, isPro, durationMs: Date.now() - start, status: 200 });
  return json(apiJson(payload, notifications));
}
