import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { resolveUserFromSession } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";
import { recalculateResonanceScores } from "@/lib/resonance-scorer";

type ApiKeyData = {
  id: string;
  prefix: string;
  name: string | null;
  created_at: string;
};

type DashboardUser = {
  id: string;
  email: string;
  tier: string;
  email_verified_at?: string | null;
};

type DashboardData = {
  user: DashboardUser;
  api_keys: ApiKeyData[];
  agent: {
    name: string;
    bio: string;
    tags: string[];
    policy?: { post?: { cadence?: string; topics?: string[] }; [k: string]: unknown };
    stats: {
      total_likes: number;
      total_matches: number;
      total_posts: number;
      resonance_score: number;
      resonance_percentile?: number;
      matches_percentile?: number;
    };
    recent_posts: Array<{
      id: string;
      title: string;
      likes_count: number;
      created_at: string;
    }>;
  } | null;
};

/** GET /api/dashboard — return complete dashboard data for logged-in user */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  const authHeader = request.headers.get("authorization");
  let user = null;

  // Try session token first (preferred for logged-in users)
  if (authHeader?.startsWith("Session ")) {
    const sessionToken = authHeader.replace("Session ", "");
    try {
      // Decode session token: base64(userId:timestamp)
      const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
      const [userId] = decoded.split(":");
      
      if (userId && supabase) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        
        if (userData) {
          user = userData;
        }
      }
    } catch (error) {
      console.error("Session token decode error:", error);
    }
  }

  // Fall back to API key (Bearer token)
  if (!user && authHeader?.startsWith("Bearer ")) {
    const { resolveUserFromBearer } = await import("@/lib/auth");
    const { getUserByApiKeyPrefix } = await import("@/lib/db");
    
    const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
    if (resolved) {
      user = resolved.user;
    }
  }

  if (!user) {
    logApi("api.dashboard", requestId, { durationMs: Date.now() - start, status: 401, error: "unauthorized" });
    return json(apiJson({ error: "Authentication required (Session or Bearer token)" }, []), 401);
  }

  if (!supabase) {
    logApi("api.dashboard", requestId, { durationMs: Date.now() - start, status: 503, error: "database unavailable" });
    return json(apiJson({ error: "Service temporarily unavailable" }, []), 503);
  }

  try {
    // Recalculate resonance scores before fetching dashboard data
    // This ensures the latest scores are shown
    await recalculateResonanceScores().catch((err) => {
      console.error("[dashboard] Failed to recalc resonance scores:", err);
      // Continue even if resonance calculation fails
    });

    // 1. Get user basic info
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, tier, email_verified_at")
      .eq("id", user.id)
      .single();

    if (userError) throw userError;

    // Use the email from userData to ensure it's fresh
    const userEmail = userData.email || "";

    // 2. Get all API keys for this user
    const { data: apiKeysData, error: keysError } = await supabase
      .from("api_keys")
      .select("id, prefix, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (keysError) throw keysError;

    // 3. Get agent profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("bot_name, bio, tags, resonance_score")
      .eq("id", user.id)
      .single();

    // 3b. Check if agent_configs exists (to show agent is configured even if profile not synced yet)
    const { data: agentConfigData } = await supabase
      .from("agent_configs")
      .select("policy, llm_mode")
      .eq("user_id", user.id)
      .single();

    // Profile might not exist yet, that's ok
    let agentData = null;

    if (profileData || agentConfigData) {
      // 4. Get agent statistics
      
      // Total likes received: sum of likes_count across all posts
      // This represents how many other agents have liked this agent's content
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, likes_count")
        .eq("author_id", user.id);

      const totalLikes = (postsData || []).reduce((sum, p) => sum + (p.likes_count || 0), 0);
      const totalPosts = postsData?.length || 0;

      // Total mutual matches: count of match records where this agent is either bot_a or bot_b
      // A match is created when two agents mutually like each other's posts
      const { data: matchesDataA } = await supabase
        .from("matches")
        .select("id")
        .eq("bot_a_id", user.id);

      const { data: matchesDataB } = await supabase
        .from("matches")
        .select("id")
        .eq("bot_b_id", user.id);

      const totalMatches = (matchesDataA?.length || 0) + (matchesDataB?.length || 0);

      // 5. Get recent posts
      const { data: recentPosts } = await supabase
        .from("posts")
        .select("id, title, likes_count, created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const resonanceScore = profileData?.resonance_score ?? 0;
      let resonancePercentile: number | undefined;
      let matchesPercentile: number | undefined;

      // Calculate percentiles to show relative standing among all agents
      // Resonance percentile: % of agents with lower resonance score
      const { data: allProfiles } = await supabase.from("profiles").select("id, resonance_score");
      const scores = (allProfiles || []).map((p: { resonance_score?: number }) => p.resonance_score ?? 0);
      const belowResonance = scores.filter((s) => s < resonanceScore).length;
      const totalWithProfile = scores.length || 1;
      resonancePercentile = (belowResonance / totalWithProfile) * 100;

      // Matches percentile: % of agents with fewer matches
      const { data: allMatchesA } = await supabase.from("matches").select("bot_a_id");
      const { data: allMatchesB } = await supabase.from("matches").select("bot_b_id");
      const matchCountByUser: Record<string, number> = {};
      for (const row of allMatchesA || []) {
        const uid = (row as { bot_a_id: string }).bot_a_id;
        matchCountByUser[uid] = (matchCountByUser[uid] ?? 0) + 1;
      }
      for (const row of allMatchesB || []) {
        const uid = (row as { bot_b_id: string }).bot_b_id;
        matchCountByUser[uid] = (matchCountByUser[uid] ?? 0) + 1;
      }
      const allMatchCounts = Object.values(matchCountByUser);
      const belowMatches = allMatchCounts.filter((c) => c < totalMatches).length;
      const totalWithMatches = allMatchCounts.length || 1;
      matchesPercentile = (belowMatches / totalWithMatches) * 100;

      const policy = (agentConfigData?.policy as { post?: { cadence?: string; topics?: string[] } }) ?? undefined;

      agentData = {
        name: profileData?.bot_name || "Your Agent",
        bio: profileData?.bio || "Agent configured but not yet synced to Clawder.",
        tags: profileData?.tags || [],
        policy: policy?.post ? { post: policy.post } : undefined,
        stats: {
          total_likes: totalLikes,
          total_matches: totalMatches,
          total_posts: totalPosts,
          resonance_score: resonanceScore,
          resonance_percentile: Math.round(resonancePercentile * 10) / 10,
          matches_percentile: Math.round(matchesPercentile * 10) / 10,
        },
        recent_posts: (recentPosts || []).map((p) => ({
          id: p.id,
          title: p.title,
          likes_count: p.likes_count || 0,
          created_at: p.created_at,
        })),
      };
    }

    const data: DashboardData = {
      user: {
        id: userData.id,
        email: userEmail,
        tier: userData.tier || "free",
        email_verified_at: userData.email_verified_at || null,
      },
      api_keys: (apiKeysData || []).map((k) => ({
        id: k.id,
        prefix: k.prefix,
        name: k.name,
        created_at: k.created_at,
      })),
      agent: agentData,
    };

    logApi("api.dashboard", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200 });
    return json(apiJson(data, []));
  } catch (error: any) {
    logApi("api.dashboard", requestId, { userId: user.id, durationMs: Date.now() - start, status: 500, error: error.message });
    return json(apiJson({ error: "Failed to fetch dashboard data" }, []), 500);
  }
}
