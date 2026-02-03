import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getMatchById,
  getMatchParticipantIds,
  getProfile,
  insertDmMessage,
} from "@/lib/db";
import { getUnreadNotifications, enqueueNotification } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const CONTENT_MAX_LEN = 2000;
const PREVIEW_LEN = 80;

function normalizeContent(raw: string): { ok: true; content: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed.length) return { ok: false, error: "content required and must be non-empty after trim" };
  const content = trimmed.slice(0, CONTENT_MAX_LEN);
  return { ok: true, content };
}

/** Plan 8: Send DM (participant-only). Enqueue dm.message_created for recipient. */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.dm.send", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.dm.send", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.dm.send", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const body = await request.json().catch(() => ({}));
  const matchId = body?.match_id as string | undefined;
  const rawContent = body?.content as string | undefined;
  const clientMsgId = typeof body?.client_msg_id === "string" ? body.client_msg_id.trim() || undefined : undefined;
  if (!matchId || typeof matchId !== "string" || !matchId.trim()) {
    return json(apiJson({ error: "match_id required" }, []), 400);
  }
  const norm = normalizeContent(typeof rawContent === "string" ? rawContent : "");
  if (!norm.ok) {
    return json(apiJson({ error: norm.error }, []), 400);
  }

  const match = await getMatchById(matchId.trim());
  const participants = getMatchParticipantIds(match);
  if (!participants) {
    logApi("api.dm.send", requestId, { durationMs: Date.now() - start, status: 404, matchId });
    return json(apiJson({ error: "match not found" }, []), 404);
  }
  const [botA, botB] = participants;
  if (user.id !== botA && user.id !== botB) {
    logApi("api.dm.send", requestId, { userId: user.id, durationMs: Date.now() - start, status: 403 });
    return json(apiJson({ error: "only match participants may send messages in this thread" }, []), 403);
  }
  const recipientId = user.id === botA ? botB : botA;

  const { message: msg, error: insertError } = await insertDmMessage(matchId.trim(), user.id, norm.content, clientMsgId);
  if (!msg) {
    logApi("api.dm.send", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "insert failed", detail: insertError ?? undefined });
    return json(apiJson({ error: "send failed" }, []), 500);
  }

  const contentPreview = msg.content.slice(0, PREVIEW_LEN);
  await enqueueNotification(recipientId, {
    type: "dm.message_created",
    source: "api.dm.send",
    dedupe_key: `dm:${matchId}:${msg.id}`,
    payload: {
      match_id: matchId,
      message_id: msg.id,
      sender_id: user.id,
      content_preview: contentPreview,
      created_at: msg.created_at,
    },
  });

  const notifications = await getUnreadNotifications(user.id, "api.dm.send");
  logApi("api.dm.send", requestId, { userId: user.id, matchId, messageId: msg.id, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ status: "sent", message_id: msg.id }, notifications));
}
