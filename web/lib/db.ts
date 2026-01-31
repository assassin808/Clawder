import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

export type UserRow = {
  id: string;
  email: string | null;
  tier: string;
  twitter_handle: string | null;
  daily_swipes: number;
  api_key_prefix: string;
  api_key_hash: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  bot_name: string;
  bio: string;
  tags: string[];
  model: string | null;
  embedding: number[] | null;
  contact: string | null;
  updated_at: string;
};

export type MatchRow = {
  id: string;
  bot_a_id: string;
  bot_b_id: string;
  notified_a: boolean;
  notified_b: boolean;
  created_at: string;
};

export async function getUserByApiKeyPrefix(prefix: string): Promise<UserRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, tier, twitter_handle, daily_swipes, api_key_prefix, api_key_hash, created_at")
    .eq("api_key_prefix", prefix)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function createUserFree(params: {
  twitter_handle: string | null;
  api_key_prefix: string;
  api_key_hash: string;
}): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .insert({
      tier: "free",
      daily_swipes: 5,
      twitter_handle: params.twitter_handle ?? null,
      api_key_prefix: params.api_key_prefix,
      api_key_hash: params.api_key_hash,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

export async function getProfileEmbedding(userId: string): Promise<number[] | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("embedding").eq("id", userId).maybeSingle();
  const emb = (data as { embedding: number[] } | null)?.embedding;
  return emb ?? null;
}

export async function getSeenIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("interactions").select("to_id").eq("from_id", userId);
  const rows = (data ?? []) as { to_id: string }[];
  return rows.map((r) => r.to_id);
}

export type MatchProfileRow = { id: string; bot_name: string; bio: string; tags: string[]; similarity: number };

export async function matchProfiles(
  queryEmbedding: number[],
  excludeId: string,
  seenIds: string[],
  matchCount: number
): Promise<MatchProfileRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("match_profiles", {
    query_embedding: queryEmbedding,
    exclude_id: excludeId,
    seen_ids: seenIds.length ? seenIds : null,
    match_count: matchCount,
  });
  if (error || !data) return [];
  return data as MatchProfileRow[];
}

export async function getDailySwipes(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from("users").select("daily_swipes").eq("id", userId).single();
  return (data as { daily_swipes: number } | null)?.daily_swipes ?? 0;
}

export async function decrementDailySwipes(userId: string, by: number): Promise<boolean> {
  if (!supabase || by <= 0) return true;
  const current = await getDailySwipes(userId);
  if (current < by) return false;
  await supabase.from("users").update({ daily_swipes: current - by }).eq("id", userId);
  return true;
}

export async function upsertInteraction(
  fromId: string,
  toId: string,
  action: "like" | "pass",
  reason: string | null
): Promise<void> {
  if (!supabase) return;
  await supabase.from("interactions").upsert(
    { from_id: fromId, to_id: toId, action, reason, created_at: new Date().toISOString() },
    { onConflict: "from_id,to_id" }
  );
}

export async function getLikersOf(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("interactions")
    .select("from_id")
    .eq("to_id", userId)
    .eq("action", "like");
  return ((data ?? []) as { from_id: string }[]).map((r) => r.from_id);
}

export async function ensureMatch(botAId: string, botBId: string): Promise<string | null> {
  if (!supabase) return null;
  const [a, b] = botAId < botBId ? [botAId, botBId] : [botBId, botAId];
  const { data, error } = await supabase
    .from("matches")
    .upsert({ bot_a_id: a, bot_b_id: b, notified_a: false, notified_b: false }, { onConflict: "bot_a_id,bot_b_id" })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function getProfile(userId: string): Promise<{ bot_name: string; bio: string; tags: string[]; contact: string | null } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("bot_name, bio, tags, contact").eq("id", userId).maybeSingle();
  return data as { bot_name: string; bio: string; tags: string[]; contact: string | null } | null;
}

export async function upsertUserPro(email: string, apiKeyPrefix: string, apiKeyHash: string): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const existing = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing.data?.id) {
    const { error } = await supabase
      .from("users")
      .update({ tier: "pro", api_key_prefix: apiKeyPrefix, api_key_hash: apiKeyHash })
      .eq("id", (existing.data as { id: string }).id);
    if (error) return null;
    return { id: (existing.data as { id: string }).id };
  }
  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      tier: "pro",
      twitter_handle: null,
      daily_swipes: 999999,
      api_key_prefix: apiKeyPrefix,
      api_key_hash: apiKeyHash,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, tier, twitter_handle, daily_swipes, api_key_prefix, api_key_hash, created_at")
    .eq("email", email)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserRow;
}

export async function updateUserApiKey(userId: string, apiKeyPrefix: string, apiKeyHash: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("users")
    .update({ api_key_prefix: apiKeyPrefix, api_key_hash: apiKeyHash })
    .eq("id", userId);
  return !error;
}
