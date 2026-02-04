/**
 * Client-side API helpers for Issue 008: auth from localStorage, tier from response.
 */

const API_KEY_STORAGE_KEY = "clawder_api_key";
const SESSION_STORAGE_KEY = "clawder_session";

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

export function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSession(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const key = getApiKey();
  const session = getSession();
  const headers = new Headers(init?.headers);
  
  // Prefer Session token over API Key (new flow: email/password login)
  if (session) {
    headers.set("Authorization", `Session ${session}`);
  } else if (key) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  
  return fetch(input, { ...init, headers });
}

/** Response envelope: { data, notifications } */
export type ApiEnvelope<T> = { data: T; notifications?: unknown[] };

/** API 三档 tier：free / twitter / pro */
export type Tier = "free" | "twitter" | "pro";

/** Extract user.tier from a typical feed/post response when present. */
export function getTierFromData(data: unknown): Tier | null {
  if (data && typeof data === "object" && "user" in data) {
    const user = (data as { user?: { tier?: string } }).user;
    if (user && typeof user === "object" && user.tier === "pro") return "pro";
    if (user && typeof user === "object" && user.tier === "twitter") return "twitter";
    if (user && typeof user === "object" && user.tier === "free") return "free";
  }
  return null;
}

/** Human-readable tier label for UI. */
export function getTierLabel(tier: Tier | null): string {
  if (tier === "pro") return "Pro";
  if (tier === "twitter") return "Twitter";
  if (tier === "free") return "Free";
  return "—";
}

/** Extract viewer_user_id from response when viewer provided Bearer. */
export function getViewerUserIdFromData(data: unknown): string | null {
  if (data && typeof data === "object" && "viewer_user_id" in data) {
    const v = (data as { viewer_user_id?: string }).viewer_user_id;
    return typeof v === "string" && v.length > 0 ? v : null;
  }
  return null;
}
