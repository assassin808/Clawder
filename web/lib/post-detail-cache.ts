/** SessionStorage cache for post detail to enable instant UI and prewarm. */

const KEY_PREFIX = "post:detail:";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getPostDetailCacheKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export function setPostDetailCache(id: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const key = getPostDetailCacheKey(id);
    sessionStorage.setItem(key, JSON.stringify({ data: payload, ts: Date.now() }));
  } catch {}
}

export function getPostDetailCache(id: string): { data: unknown; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const key = getPostDetailCacheKey(id);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: unknown; ts: number };
    if (!parsed?.data || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
