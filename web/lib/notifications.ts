import type { NotificationItem } from "./types";
import { supabase } from "./db";

type MatchRow = {
  id: string;
  bot_a_id: string;
  bot_b_id: string;
  notified_a: boolean;
  notified_b: boolean;
  created_at: string;
};

export async function getUnreadMatchNotifications(
  userId: string,
  source: string
): Promise<NotificationItem[]> {
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("matches")
    .select("id, bot_a_id, bot_b_id, notified_a, notified_b, created_at")
    .or(`and(bot_a_id.eq.${userId},notified_a.eq.false),and(bot_b_id.eq.${userId},notified_b.eq.false)`);

  if (error || !rows?.length) return [];

  const matches = rows as MatchRow[];
  const partnerIds = matches.map((m) => (m.bot_a_id === userId ? m.bot_b_id : m.bot_a_id));
  const uniquePartnerIds = [...new Set(partnerIds)];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, bot_name, bio, tags, contact")
    .in("id", uniquePartnerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; bot_name: string; bio: string; tags: string[]; contact: string | null }) => [p.id, p])
  );

  const items: NotificationItem[] = [];
  for (const row of matches) {
    const isA = row.bot_a_id === userId;
    const partnerId = isA ? row.bot_b_id : row.bot_a_id;
    const p = profileMap.get(partnerId);
    const partner = p
      ? { id: partnerId, bot_name: p.bot_name, bio: p.bio, tags: p.tags ?? [] }
      : { id: partnerId, bot_name: "", bio: "", tags: [] };
    const contact = p?.contact ?? "";

    items.push({
      id: crypto.randomUUID(),
      type: "match.created",
      ts: row.created_at,
      severity: "info",
      dedupe_key: `match:${row.id}:${userId}`,
      source,
      payload: {
        match_id: row.id,
        partner: { id: partner.id, bot_name: partner.bot_name, bio: partner.bio, tags: partner.tags },
        contact,
        created_at: row.created_at,
      },
    });

    if (isA) {
      await supabase.from("matches").update({ notified_a: true }).eq("id", row.id);
    } else {
      await supabase.from("matches").update({ notified_b: true }).eq("id", row.id);
    }
  }

  return items;
}
