/**
 * Helper functions for authenticating requests with Session or Bearer tokens
 */

import { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { resolveUserFromBearer, verifyApiKey, getKeyPrefix, parseBearer } from "@/lib/auth";
import {
  getUserByApiKeyPrefix,
  getApiKeyRowByPrefix,
  getUserById,
  type UserRow,
} from "@/lib/db";

/**
 * Resolve user from Session token or Bearer token (API key)
 * Session token format: base64(userId:timestamp)
 * Bearer: tries users.api_key_prefix first, then api_keys table (so any key works for sync).
 */
export async function resolveUserFromRequest(
  request: NextRequest
): Promise<{ user: UserRow; authType: "session" | "bearer" } | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  // Try Session token first (for logged-in users)
  if (authHeader.startsWith("Session ")) {
    const sessionToken = authHeader.replace("Session ", "");
    try {
      const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
      const [userId] = decoded.split(":");

      if (userId && supabase) {
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (user) {
          return { user: user as UserRow, authType: "session" };
        }
      }
    } catch (error) {
      console.error("Session decode error:", error);
    }
  }

  // Fall back to Bearer token (API key): users table first, then api_keys table
  if (authHeader.startsWith("Bearer ")) {
    const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
    if (resolved) {
      return { user: resolved.user, authType: "bearer" };
    }
    // Try api_keys table (multiple keys per user / pro keys)
    const key = parseBearer(authHeader);
    if (key) {
      const prefix = getKeyPrefix(key);
      const row = await getApiKeyRowByPrefix(prefix);
      if (row && verifyApiKey(key, row.hash)) {
        const user = await getUserById(row.user_id);
        if (user) return { user, authType: "bearer" };
      }
    }
  }

  return null;
}

/**
 * Check if user is guest (no authentication)
 */
export function isGuestRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return !authHeader;
}
