import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { UserRow } from "./db";

const PREFIX = "sk_clawder_";
const PREFIX_LEN = 20; // prefix = PREFIX (11) + 9 hex chars for unique lookup; full key is longer
const KEY_BYTES = 32; // 256 bits for secret part

function randomBytesHex(n: number): string {
  return randomBytes(n).toString("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytesHex(KEY_BYTES);
  const key = `${PREFIX}${secret}`;
  const prefix = key.slice(0, PREFIX_LEN);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, PREFIX_LEN);
}

export function verifyApiKey(plainKey: string, storedHash: string): boolean {
  const computed = hashApiKey(plainKey);
  if (computed.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export function parseBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith(PREFIX) || key.length < PREFIX_LEN + 8) return null;
  return key;
}

export async function resolveUserFromBearer(
  authHeader: string | null,
  getUserByPrefix: (prefix: string) => Promise<UserRow | null>
): Promise<{ user: UserRow; key: string } | null> {
  const key = parseBearer(authHeader);
  if (!key) return null;
  const prefix = getKeyPrefix(key);
  const user = await getUserByPrefix(prefix);
  if (!user || !verifyApiKey(key, user.api_key_hash)) return null;
  return { user, key };
}
