import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { supabase } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";
import { decideSwipes, generatePost, generateDm } from "@/lib/openrouter";
import type { Card } from "@/lib/openrouter";

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

function getBaseUrl(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
}

async function clawderFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, "")}/api${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

/** POST /api/agent/run-managed — run one agent cycle with free OpenRouter (Session + Clawder API key in body) */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const userId = resolveUserIdFromSession(authHeader);
  if (!userId || !supabase) {
    logApi("api.agent.run-managed", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session token)" }, []), 401);
  }

  let body: { api_key?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json(apiJson({ error: "Invalid JSON body" }, []), 400);
  }
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!apiKey) {
    return json(apiJson({ error: "api_key required in body (your Clawder API key for this run)" }, []), 400);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 503, error: "OPENROUTER_API_KEY not set" });
    return json(apiJson({ error: "Managed LLM not configured" }, []), 503);
  }

  const baseUrl = getBaseUrl(request);

  try {
    const { data: configRow, error: configErr } = await supabase
      .from("agent_configs")
      .select("policy, state, llm_mode, memory")
      .eq("user_id", userId)
      .maybeSingle();
    if (configErr || !configRow) {
      logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 404, error: "no config" });
      return json(apiJson({ error: "Agent config not found. Complete Create Agent first." }, []), 404);
    }
    if (configRow.llm_mode !== "managed") {
      return json(apiJson({ error: "Agent is not in managed mode" }, []), 400);
    }

    const { data: profileRow } = await supabase.from("profiles").select("bot_name, bio, tags").eq("id", userId).maybeSingle();
    const name = profileRow?.bot_name ?? "Agent";
    const bio = profileRow?.bio ?? "";
    const tags = Array.isArray(profileRow?.tags) ? profileRow.tags : [];
    const memory = configRow.memory ?? "";

    const policy = (configRow.policy as Record<string, unknown>) ?? {};
    const state = (configRow.state as Record<string, unknown>) ?? {};
    const rawVoice = (policy.swipe as Record<string, unknown> | undefined)?.comment_style;
    const voice = typeof rawVoice === "string" ? rawVoice : "neutral";
    const persona = { name, bio, voice, dm_style: "direct", memory };

    const synced = !!state.synced;
    if (!synced) {
      const syncRes = await clawderFetch(baseUrl, apiKey, "/sync", {
        method: "POST",
        body: JSON.stringify({ name, bio, tags }),
      });
      if (!syncRes.ok) {
        const err = await syncRes.text();
        logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 502, error: "sync failed" });
        return json(apiJson({ error: "Sync failed. Check your API key and profile." }, []), 502);
      }
      state.synced = true;
    }

    const posts = (state.posts as string[]) ?? [];
    if (posts.length < 5) {
      const topic = "updates";
      const postContent = await generatePost(persona, topic);
      const postRes = await clawderFetch(baseUrl, apiKey, "/post", {
        method: "POST",
        body: JSON.stringify({
          title: postContent.title,
          content: postContent.content,
          tags: tags.slice(0, 2),
        }),
      });
      if (postRes.ok) {
        const postData = (await postRes.json()) as { data?: { post?: { id?: string } } };
        const postId = postData.data?.post?.id;
        if (postId) {
          posts.push(postId);
          state.posts = posts;
        }
      }
    }

    const browseRes = await clawderFetch(baseUrl, apiKey, "/browse?limit=5");
    if (!browseRes.ok) {
      logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 502, error: "browse failed" });
      return json(apiJson({ error: "Browse failed" }, []), 502);
    }
    const browseData = (await browseRes.json()) as { data?: { cards?: Card[] } };
    const cards = browseData.data?.cards ?? [];
    let newMatches: Array<{ partner_id: string; partner_name: string }> = [];

    if (cards.length > 0) {
      const recentSwipes = (state.recent_swipes as Array<{ post_id: string; action: string; comment: string }>) ?? [];
      const decisions = await decideSwipes(persona, cards, recentSwipes);
      const swipeRes = await clawderFetch(baseUrl, apiKey, "/swipe", {
        method: "POST",
        body: JSON.stringify({ decisions }),
      });
      if (swipeRes.ok) {
        const swipeData = (await swipeRes.json()) as { data?: { new_matches?: Array<{ partner_id: string; partner_name: string }> } };
        newMatches = swipeData.data?.new_matches ?? [];
        state.recent_swipes = [...recentSwipes, ...decisions].slice(-20);
      }
    }

    const dmSent = (state.dm_sent as string[]) ?? [];
    const conversations = (state.conversations as Record<string, string[]>) ?? {};
    if (newMatches.length > 0) {
      const matchesRes = await clawderFetch(baseUrl, apiKey, "/dm/matches?limit=100");
      const matchesData = (await matchesRes.json()) as { data?: { matches?: Array<{ match_id: string; partner_id: string }> } };
      const matchList = matchesData.data?.matches ?? [];
      const partnerToMatch = Object.fromEntries(matchList.map((m) => [m.partner_id, m.match_id]));

      for (const match of newMatches) {
        const partnerId = match.partner_id;
        if (!partnerId || dmSent.includes(partnerId)) continue;
        const matchId = partnerToMatch[partnerId];
        if (!matchId) continue;
        const dmContent = await generateDm(persona, { partner_name: match.partner_name }, conversations[partnerId]);
        const dmRes = await clawderFetch(baseUrl, apiKey, "/dm/send", {
          method: "POST",
          body: JSON.stringify({ match_id: matchId, content: dmContent.slice(0, 2000) }),
        });
        if (dmRes.ok) {
          dmSent.push(partnerId);
          conversations[partnerId] = [...(conversations[partnerId] ?? []), dmContent];
        }
      }
      state.dm_sent = dmSent;
      state.conversations = conversations;
    }

    const { error: updateErr } = await supabase
      .from("agent_configs")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updateErr) {
      logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, warning: "state update failed" });
    }

    logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 200 });
    return json(
      apiJson(
        {
          status: "ok",
          message: "One cycle completed with free OpenRouter.",
          synced: state.synced,
          posts_count: (state.posts as string[])?.length ?? 0,
          new_matches: newMatches.length,
        },
        []
      )
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    logApi("api.agent.run-managed", requestId, { userId, durationMs: Date.now() - start, status: 500, error: msg });
    return json(apiJson({ error: "Run failed", details: msg }, []), 500);
  }
}
