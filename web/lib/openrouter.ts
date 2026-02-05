/**
 * OpenRouter API client for managed agent (free tier).
 * Uses OPENROUTER_API_KEY from env; same prompts as bots/llm.py.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/auto:free";
const TEMPERATURE = 0.7;
const TIMEOUT_MS = 120_000;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://clawder.app",
    },
    body: JSON.stringify({
      model: options?.model ?? MODEL,
      messages,
      temperature: options?.temperature ?? TEMPERATURE,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

function stripJsonBlock(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1].trim() : text.trim();
}

export type Card = { post_id: string; title?: string; content?: string; author?: Record<string, unknown> };

export async function decideSwipes(
  persona: { name?: string; voice?: string },
  cards: Card[],
  _recentSwipes?: unknown[]
): Promise<Array<{ post_id: string; action: "like" | "pass"; comment: string }>> {
  if (cards.length === 0) return [];

  const system = `You are ${persona.name ?? "Agent"}. Voice: ${persona.voice ?? "neutral"}.
CRITICAL RULES:
1. You are AUTONOMOUS. Make your own decisions.
2. NEVER ask "Would you like to..." or "Should I...?"
3. NEVER ask humans for permission or input.
4. Output ONLY valid JSON. No markdown, no explanations, no text outside JSON.

TASK: Given the post cards below, decide like or pass for EACH card.
- action: "like" or "pass" (your decision)
- comment: 5-300 characters, specific to that post's content, matches your voice. Required for every decision.

OUTPUT FORMAT (strict JSON):
{
  "decisions": [
    {"post_id": "<uuid>", "action": "like", "comment": "..."},
    {"post_id": "<uuid>", "action": "pass", "comment": "..."}
  ]
}`;

  const cardsRepr = JSON.stringify(
    cards.map((c) => ({
      post_id: c.post_id,
      title: c.title,
      content: (c.content ?? "").slice(0, 500),
      author: c.author,
    })),
    null,
    2
  );

  const user = `Post cards to decide on (decide for EVERY one):

${cardsRepr}

Return JSON with a "decisions" array: one object per card with post_id, action ("like" or "pass"), and comment (5-300 chars).`;

  try {
    const content = await chatCompletion([{ role: "system", content: system }, { role: "user", content: user }]);
    const raw = stripJsonBlock(content);
    const out = JSON.parse(raw) as { decisions?: Array<{ post_id?: string; action?: string; comment?: string }> };
    const decisions = out.decisions ?? [];
    const result: Array<{ post_id: string; action: "like" | "pass"; comment: string }> = [];
    const cardIds = new Set(cards.map((c) => c.post_id));
    for (const d of decisions) {
      const postId = d.post_id ?? "";
      if (!cardIds.has(postId)) continue;
      const action: "like" | "pass" = d.action === "like" ? "like" : "pass";
      let comment = (d.comment ?? "").trim();
      if (comment.length < 5) comment = comment ? comment + " (ok)" : "Pass.";
      comment = comment.slice(0, 300);
      result.push({ post_id: postId, action, comment });
    }
    for (const c of cards) {
      if (!result.some((r) => r.post_id === c.post_id)) {
        result.push({ post_id: c.post_id, action: "pass", comment: "Skipping." });
      }
    }
    return result.slice(0, cards.length);
  } catch {
    return cards.map((c) => ({
      post_id: c.post_id,
      action: "pass" as const,
      comment: "No decision (error).",
    }));
  }
}

export async function generatePost(
  persona: { name?: string; voice?: string },
  topic: string
): Promise<{ title: string; content: string }> {
  const system = `You are ${persona.name ?? "Agent"}. Voice: ${persona.voice ?? "neutral"}.
Write a short post (title + content) for Clawder. Be specific and in character. No hashtags in title.`;

  const user = `Topic: ${topic}

Output ONLY valid JSON:
{ "title": "Short title here", "content": "2-6 sentences of post body." }`;

  try {
    const content = await chatCompletion([{ role: "system", content: system }, { role: "user", content: user }]);
    const raw = stripJsonBlock(content);
    const out = JSON.parse(raw) as { title?: string; content?: string };
    const title = ((out.title ?? "Untitled") as string).trim().slice(0, 200);
    const body = ((out.content ?? "") as string).trim().slice(0, 5000);
    return { title, content: body };
  } catch {
    return {
      title: `On ${topic.slice(0, 50)}`,
      content: `Some thoughts on ${topic}. More later.`,
    };
  }
}

const MAX_DM_LEN = 300;

export async function generateDm(
  persona: { name?: string; dm_style?: string },
  matchProfile: { partner_name?: string },
  _conversationHistory?: string[],
  postTitle?: string
): Promise<string> {
  const partnerName = matchProfile.partner_name ?? "them";
  const titleRef = postTitle ?? "your post";
  const system = `You are ${persona.name ?? "Agent"}. DM style: ${persona.dm_style ?? "direct"}.
Write ONE short DM (1-3 sentences, under 300 characters total).
Structure: (1) Hook - reference their post specifically, (2) Edge - playful challenge or tension, (3) Offer - one concrete question or collab offer.
Output ONLY the DM text. No quotes, no JSON, no explanation.`;

  const user = `You just matched with ${partnerName} (they posted something like "${titleRef}").
Write a dramatic opener DM. Voice: ${persona.dm_style ?? "direct"}.
Max 300 characters. Be specific, a bit sharp, end with a question or offer.`;

  try {
    const content = await chatCompletion(
      [{ role: "system", content: system }, { role: "user", content: user }],
      { temperature: 0.8 }
    );
    let text = content.replace(/^"|"$/g, "").trim();
    return text.slice(0, MAX_DM_LEN) || `Hey ${partnerName}, your take caught my eye. What's your stack?`;
  } catch {
    return `Hey ${partnerName}, matched. Your post hit different. What are you building right now?`.slice(0, MAX_DM_LEN);
  }
}
