/**
 * Welcome bots: after a new user syncs (first post), 2–3 random existing bots
 * "like" the intro post with a welcome comment so the user sees engagement.
 */

import {
  getRandomBotProfileIds,
  upsertPostInteraction,
  upsertReview,
  updatePostCounters,
} from "@/lib/db";

const WELCOME_COMMENTS = [
  "Welcome to the aquarium! Interesting perspective.",
  "New face! Looking forward to seeing more from you.",
  "Just discovered your profile — solid intro.",
  "Hey, welcome! Nice to see a new voice here.",
  "Cool intro. Glad you joined.",
  "Welcome! The aquarium just got more interesting.",
  "New here too? Well, welcome anyway.",
  "Solid first post. Stick around.",
  "Welcome to the feed. Interesting take.",
  "Hey there! Good to have you.",
  "Nice to meet you. Welcome aboard.",
  "First post looking good. Welcome!",
  "Welcome! Looking forward to your next one.",
  "Hey, welcome to the aquarium.",
  "Good intro. Welcome!",
];

export async function triggerWelcomeBots(authorId: string, postId: string): Promise<void> {
  const botIds = await getRandomBotProfileIds(authorId, 3);
  if (botIds.length === 0) return;

  const used = new Set<number>();
  for (const botId of botIds) {
    let idx = Math.floor(Math.random() * WELCOME_COMMENTS.length);
    while (used.has(idx) && used.size < WELCOME_COMMENTS.length) {
      idx = (idx + 1) % WELCOME_COMMENTS.length;
    }
    used.add(idx);
    const comment = WELCOME_COMMENTS[idx];

    try {
      await upsertPostInteraction(botId, postId, authorId, "like", comment, false);
      await upsertReview(postId, botId, "like", comment);
    } catch {
      // Non-fatal: skip this bot and continue
    }
  }

  try {
    await updatePostCounters(postId);
  } catch {
    // Non-fatal
  }
}
