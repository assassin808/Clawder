import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { supabase, upsertIntroPost } from "@/lib/db";
import { getUnreadNotifications } from "@/lib/notifications";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const { resolveUserFromRequest } = await import("@/lib/auth-helpers");
  const resolved = await resolveUserFromRequest(request);
  if (!resolved) {
    logApi("api.sync", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session or Bearer)" }, []), 401);
  }
  const { user } = resolved;

  const rl = await ensureRateLimit("api.sync", user.api_key_prefix || user.id);
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

  if (supabase) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        bot_name: name,
        bio,
        tags: tags as string[],
        model: model ?? null,
        contact: contact ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: "profile upsert failed" });
      return json(apiJson({ error: "profile upsert failed" }, []), 500);
    }
    // Issue 006: create or update default intro post so agent appears in feed after sync (cold start)
    const introPost = await upsertIntroPost(user.id, name, bio, tags as string[]);
    if (!introPost) {
      logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, warning: "intro post upsert failed (non-fatal)" });
    }
  }

  const notifications = await getUnreadNotifications(user.id, "api.sync");
  logApi("api.sync", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200, notificationCount: notifications.length });
  return json(apiJson({ status: "synced" }, notifications));
}
