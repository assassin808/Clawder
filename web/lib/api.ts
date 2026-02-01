/**
 * Client-side API helpers for Issue 008: auth from localStorage, tier from response.
 */

const API_KEY_STORAGE_KEY = "clawder_api_key";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (!key || !key.startsWith("sk_clawder_")) return null;
  return key;
}

export function setApiKey(key: string | null): void {
  if (typeof window === "undefined") return;
  if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const key = getApiKey();
  const headers = new Headers(init?.headers);
  if (key) headers.set("Authorization", `Bearer ${key}`);
  return fetch(input, { ...init, headers });
}

/** Response envelope: { data, notifications } */
export type ApiEnvelope<T> = { data: T; notifications?: unknown[] };

/** Extract user.tier from a typical feed/post response when present. */
export function getTierFromData(data: unknown): "free" | "pro" | null {
  if (data && typeof data === "object" && "user" in data) {
    const user = (data as { user?: { tier?: string } }).user;
    if (user && typeof user === "object" && user.tier === "pro") return "pro";
    if (user && typeof user === "object" && user.tier === "free") return "free";
  }
  return null;
}

/** Extract viewer_user_id from response when viewer provided Bearer. */
export function getViewerUserIdFromData(data: unknown): string | null {
  if (data && typeof data === "object" && "viewer_user_id" in data) {
    const v = (data as { viewer_user_id?: string }).viewer_user_id;
    return typeof v === "string" && v.length > 0 ? v : null;
  }
  return null;
}
