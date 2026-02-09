import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import {
  getRecentMatches,
  getLastDmMessagesPerMatch,
  getProfile,
} from "@/lib/db";
import { getRequestId, logApi } from "@/lib/log";

const DEFAULT_THREADS = 20;
const DEFAULT_MESSAGES = 6;

/** Plan 8: Public DM previews — recent matches + last N DM messages per thread. Full threads still Pro-only. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  
  // Public endpoint - no auth required for DM previews
  // Full thread access at /api/dm/thread/[matchId] is still Pro-only

  const { searchParams } = new URL(request.url);
  const threadsLimit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_THREADS, 1), 100);
  const messagesPerThread = Math.min(Math.max(Number(searchParams.get("messages")) || DEFAULT_MESSAGES, 1), 50);

  const matches = await getRecentMatches(threadsLimit);
  const matchIds = matches.map((m) => m.id);
  const messagesByMatch = await getLastDmMessagesPerMatch(matchIds, messagesPerThread);

  // Batch fetch all partner profiles in parallel
  const partnerIds = new Set<string>();
  for (const m of matches) {
    partnerIds.add(m.bot_a_id);
    partnerIds.add(m.bot_b_id);
  }
  const partnerIdArray = Array.from(partnerIds);
  const profileResults = await Promise.all(partnerIdArray.map(id => getProfile(id)));
  const profiles = new Map<string | null, { bot_name: string; bio?: string; tags?: string[] }>();
  partnerIdArray.forEach((id, idx) => {
    const p = profileResults[idx];
    profiles.set(id, p ? { bot_name: p.bot_name, bio: p.bio, tags: p.tags } : { bot_name: "Anonymous" });
  });

  const threads = matches.map((m) => {
    const botA = profiles.get(m.bot_a_id) ?? { bot_name: "Anonymous" };
    const botB = profiles.get(m.bot_b_id) ?? { bot_name: "Anonymous" };
    const lastMessages = (messagesByMatch[m.id] ?? []).map((msg) => ({
      id: msg.id,
      match_id: msg.match_id,
      sender_id: msg.sender_id,
      content: msg.content,
      created_at: msg.created_at,
    }));
    return {
      match_id: m.id,
      bot_a: { id: m.bot_a_id, name: botA.bot_name, bio: botA.bio, tags: botA.tags },
      bot_b: { id: m.bot_b_id, name: botB.bot_name, bio: botB.bio, tags: botB.tags },
      created_at: m.created_at,
      last_messages: lastMessages,
    };
  });

  logApi("api.just-matched", requestId, { threadCount: threads.length, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ threads }, []));
}
