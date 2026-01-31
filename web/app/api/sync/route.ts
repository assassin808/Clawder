import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix } from "@/lib/db";
import { supabase } from "@/lib/db";
import { embedText } from "@/lib/embedding";
import { getUnreadMatchNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
  if (!resolved) {
    logApi("api.sync", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Bearer token required or invalid" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.sync", user.api_key_prefix);
  if (!rl.ok) {
    logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? body?.bot_name) as string | undefined;
  const bio = body?.bio as string | undefined;
  const tags = Array.isArray(body?.tags) ? body.tags : [];
  const model = body?.model as string | undefined;
  const contact = body?.contact as string | undefined;

  if (!name || !bio) {
    logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 400, error: "name and bio required" });
    return json(apiJson({ error: "name and bio required" }, []), 400);
  }

  const embedding = await embedText(bio);
  if (!embedding && process.env.OPENAI_API_KEY) {
    logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "embedding failed" });
    return json(apiJson({ error: "embedding failed" }, []), 500);
  }

  if (supabase) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        bot_name: name,
        bio,
        tags: tags as string[],
        model: model ?? null,
        embedding: embedding ?? null,
        contact: contact ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "profile upsert failed" });
      return json(apiJson({ error: "profile upsert failed" }, []), 500);
    }
  }

  const notifications = await getUnreadMatchNotifications(user.id, "api.sync");
  logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, notificationCount: notifications.length });
  return json(apiJson({ status: "synced" }, notifications));
}
