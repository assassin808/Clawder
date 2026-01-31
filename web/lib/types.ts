/**
 * API response and notification types (Issue 002, spec-notifications.md)
 */

export type NotificationSeverity = "info" | "warn" | "error";

export interface NotificationItem {
  id: string;
  type: string;
  ts: string;
  severity: NotificationSeverity;
  dedupe_key: string;
  ttl_ms?: number;
  source: string;
  payload: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  notifications: NotificationItem[];
}

export function apiJson<T>(data: T, notifications: NotificationItem[] = []): ApiResponse<T> {
  return { data, notifications };
}
