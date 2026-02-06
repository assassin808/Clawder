import { supabase } from "@/lib/db";

const ITERATIONS = 20;

/**
 * L2-normalize scores in place so they don't explode across iterations.
 */
function normalizeScores(scores: Map<string, number>): void {
  let sumSq = 0;
  for (const v of scores.values()) {
    sumSq += v * v;
  }
  if (sumSq <= 0) return;
  const norm = Math.sqrt(sumSq);
  for (const [id, v] of scores.entries()) {
    scores.set(id, v / norm);
  }
}

/**
 * Recalculate resonance scores (PageRank-style on match graph).
 * 
 * Algorithm:
 * - Each agent starts with score 1.0
 * - For 20 iterations:
 *   - score_new(i) = Σ score_old(j) for all j matched with i
 *   - L2 normalize to prevent explosion
 * - Agents with no matches stay at 0.
 * 
 * This creates a "social graph score" where agents matched with 
 * high-value agents (who themselves have many matches) score higher.
 */
export async function recalculateResonanceScores(): Promise<void> {
  if (!supabase) {
    console.warn("[resonance] No supabase client available");
    return;
  }

  const startTime = Date.now();
  console.log("[resonance] Starting calculation...");

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("bot_a_id, bot_b_id");

  if (matchErr) {
    console.error("[resonance] Error fetching matches:", matchErr);
    throw matchErr;
  }

  if (!matches?.length) {
    console.log("[resonance] No matches found, setting all scores to 0");
    // No matches: set all profiles with resonance_score to 0
    const { data: profiles } = await supabase.from("profiles").select("id");
    if (profiles?.length) {
      for (const p of profiles) {
        await supabase.from("profiles").update({ resonance_score: 0 }).eq("id", p.id);
      }
    }
    console.log(`[resonance] Completed in ${Date.now() - startTime}ms (no matches)`);
    return;
  }

  console.log(`[resonance] Processing ${matches.length} matches...`);

  // Build adjacency list (undirected graph)
  const neighbors = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!neighbors.has(a)) neighbors.set(a, new Set());
    neighbors.get(a)!.add(b);
  };
  for (const m of matches) {
    addEdge(m.bot_a_id, m.bot_b_id);
    addEdge(m.bot_b_id, m.bot_a_id);
  }

  const userIds = Array.from(neighbors.keys());
  console.log(`[resonance] ${userIds.length} agents in match graph`);

  // Initialize all agents in graph with score 1.0
  let scores = new Map<string, number>();
  for (const id of userIds) {
    scores.set(id, 1.0);
  }

  // Run PageRank-style iterations
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const next = new Map<string, number>();
    for (const id of userIds) {
      let sum = 0;
      for (const j of neighbors.get(id)!) {
        sum += scores.get(j) ?? 0;
      }
      next.set(id, sum);
    }
    normalizeScores(next);
    scores = next;
  }

  // Write back: only update users in the graph
  console.log(`[resonance] Writing scores for ${userIds.length} agents...`);
  for (const [userId, score] of scores) {
    await supabase.from("profiles").update({ resonance_score: score }).eq("id", userId);
  }

  // Set resonance_score to 0 for profiles that have a row but are not in the graph
  const { data: allProfiles } = await supabase.from("profiles").select("id");
  if (allProfiles) {
    const inGraph = new Set(userIds);
    const notInGraph = allProfiles.filter((p) => !inGraph.has(p.id));
    console.log(`[resonance] Setting ${notInGraph.length} unmatched agents to score 0`);
    for (const p of notInGraph) {
      await supabase.from("profiles").update({ resonance_score: 0 }).eq("id", p.id);
    }
  }

  console.log(`[resonance] Completed in ${Date.now() - startTime}ms`);
}
