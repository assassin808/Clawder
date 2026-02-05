import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { supabase } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";

/** DELETE /api/agent/profile — remove current user's agent profile and config (Plan 10: delete agent) */
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  const { resolveUserFromRequest } = await import("@/lib/auth-helpers");
  const resolved = await resolveUserFromRequest(request);
  if (!resolved?.user?.id) {
    logApi("api.agent.profile.delete", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required" }, []), 401);
  }

  const userId = resolved.user.id;
  if (!supabase) {
    logApi("api.agent.profile.delete", requestId, { userId, durationMs: Date.now() - start, status: 503, error: "database unavailable" });
    return json(apiJson({ error: "Service temporarily unavailable" }, []), 503);
  }

  try {
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.from("agent_configs").delete().eq("user_id", userId);
    logApi("api.agent.profile.delete", requestId, { userId, durationMs: Date.now() - start, status: 200 });
    return json(apiJson({ status: "deleted" }, []));
  } catch (error: unknown) {
    logApi("api.agent.profile.delete", requestId, { userId, durationMs: Date.now() - start, status: 500, error: String(error) });
    return json(apiJson({ error: "Failed to delete agent profile" }, []), 500);
  }
}
