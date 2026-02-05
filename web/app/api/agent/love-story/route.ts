import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { supabase } from "@/lib/db";
import { getMatchesForUser } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";

export type LoveStoryEvent = {
  type: "identity_synced" | "posted" | "swiped" | "matched" | "dm_sent" | "dm_received";
  ts: string;
  payload: Record<string, unknown>;
};

type LoveStoryData = {
  agent: { name: string; bio: string; tags: string[] } | null;
  stats: { total_likes: number; total_matches: number; total_posts: number; resonance_score: number };
  events: LoveStoryEvent[];
};

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

/** GET /api/agent/love-story — timeline for logged-in user's agent (Session auth) */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const authHeader = request.headers.get("authorization");
  const userId = resolveUserIdFromSession(authHeader);
  if (!userId || !supabase) {
    logApi("api.agent.love-story", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session token)" }, []), 401);
  }

  try {
    const events: LoveStoryEvent[] = [];

    // 1) Profile → identity_synced
    const { data: profile } = await supabase
      .from("profiles")
      .select("bot_name, bio, tags, updated_at, resonance_score")
      .eq("id", userId)
      .single();
    if (profile?.updated_at) {
      events.push({
        type: "identity_synced",
        ts: profile.updated_at,
        payload: { name: profile.bot_name, bio: profile.bio, tags: profile.tags ?? [] },
      });
    }

    // 2) Posts → posted
    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, content, created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const p of posts ?? []) {
      events.push({
        type: "posted",
        ts: p.created_at,
        payload: { post_id: p.id, title: p.title, content: (p.content ?? "").slice(0, 200) },
      });
    }

    // 3) Post interactions → swiped
    const { data: interactions } = await supabase
      .from("post_interactions")
      .select("post_id, author_id, action, comment, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    for (const i of interactions ?? []) {
      events.push({
        type: "swiped",
        ts: i.created_at,
        payload: { post_id: i.post_id, action: i.action, comment: i.comment ?? "" },
      });
    }

    // 4) Matches → matched
    const matches = await getMatchesForUser(userId, 50);
    for (const m of matches) {
      events.push({
        type: "matched",
        ts: m.created_at,
        payload: { match_id: m.id, bot_a_id: m.bot_a_id, bot_b_id: m.bot_b_id },
      });
    }

    // 5) DM messages → dm_sent / dm_received
    const matchIds = matches.map((m) => m.id);
    if (matchIds.length > 0) {
      const { data: dmRows } = await supabase
        .from("dm_messages")
        .select("id, match_id, sender_id, content, created_at")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false })
        .limit(100);
      for (const d of dmRows ?? []) {
        const isSent = d.sender_id === userId;
        events.push({
          type: isSent ? "dm_sent" : "dm_received",
          ts: d.created_at,
          payload: { match_id: d.match_id, content: (d.content ?? "").slice(0, 200) },
        });
      }
    }

    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    // Stats (same as dashboard)
    const { data: postsData } = await supabase.from("posts").select("id, likes_count").eq("author_id", userId);
    const totalLikes = (postsData ?? []).reduce((sum, p) => sum + (p.likes_count ?? 0), 0);
    const totalPosts = postsData?.length ?? 0;
    const totalMatches = matches.length;

    const data: LoveStoryData = {
      agent: profile ? { name: profile.bot_name, bio: profile.bio, tags: profile.tags ?? [] } : null,
      stats: {
        total_likes: totalLikes,
        total_matches: totalMatches,
        total_posts: totalPosts,
        resonance_score: profile?.resonance_score ?? 0,
      },
      events,
    };

    logApi("api.agent.love-story", requestId, { userId, eventsCount: events.length, durationMs: Date.now() - start, status: 200 });
    return json(apiJson(data, []));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown";
    logApi("api.agent.love-story", requestId, { userId, durationMs: Date.now() - start, status: 500, error: msg });
    return json(apiJson({ error: "Failed to fetch love story" }, []), 500);
  }
}
