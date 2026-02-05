import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { supabase } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";

function resolveUserIdFromSession(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Session ")) return null;
  const sessionToken = authHeader.replace("Session ", "").trim();
  try {
    const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
    const [userId] = decoded.split(":");
    return userId && userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

export type AgentConfigData = {
  llm_mode?: "byo" | "managed";
  llm_provider?: string | null;
  policy: Record<string, unknown>;
  state: Record<string, unknown>;
  memory?: string | null;
  updated_at?: string;
};

/** GET /api/agent/config — return current user's agent config (Session auth) */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const userId = resolveUserIdFromSession(authHeader);
  if (!userId || !supabase) {
    logApi("api.agent.config", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session token)" }, []), 401);
  }

  try {
    const { data, error } = await supabase
      .from("agent_configs")
      .select("llm_mode, llm_provider, policy, state, memory, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 500, error: error.message });
      return json(apiJson({ error: "Failed to fetch config" }, []), 500);
    }

    const config: AgentConfigData = {
      llm_mode: data?.llm_mode ?? undefined,
      llm_provider: data?.llm_provider ?? undefined,
      policy: (data?.policy as Record<string, unknown>) ?? {},
      state: (data?.state as Record<string, unknown>) ?? {},
      memory: data?.memory ?? undefined,
      updated_at: data?.updated_at ?? undefined,
    };

    logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 200 });
    return json(apiJson(config, []));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 500, error: msg });
    return json(apiJson({ error: "Failed to fetch config" }, []), 500);
  }
}

/** POST /api/agent/config — upsert current user's agent config (Session auth) */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const userId = resolveUserIdFromSession(authHeader);
  if (!userId || !supabase) {
    logApi("api.agent.config", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session token)" }, []), 401);
  }

  let body: { policy?: unknown; state?: unknown; llm_mode?: "byo" | "managed"; llm_provider?: string | null; memory?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return json(apiJson({ error: "Invalid JSON body" }, []), 400);
  }

  const policy = body.policy != null && typeof body.policy === "object" ? body.policy : {};
  const state = body.state != null && typeof body.state === "object" ? body.state : {};
  const llm_mode = body.llm_mode === "byo" || body.llm_mode === "managed" ? body.llm_mode : null;
  const llm_provider = typeof body.llm_provider === "string" ? body.llm_provider : null;
  const memory = typeof body.memory === "string" ? body.memory : null;

  const now = new Date().toISOString();

  try {
    const { error } = await supabase.from("agent_configs").upsert(
      {
        user_id: userId,
        policy,
        state,
        ...(llm_mode != null && { llm_mode }),
        ...(llm_provider !== undefined && { llm_provider }),
        ...(memory !== undefined && { memory }),
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 500, error: error.message });
      return json(apiJson({ error: "Failed to save config" }, []), 500);
    }

    logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 200 });
    return json(apiJson({ status: "saved", updated_at: now }, []));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    logApi("api.agent.config", requestId, { userId, durationMs: Date.now() - start, status: 500, error: msg });
    return json(apiJson({ error: "Failed to save config" }, []), 500);
  }
}
