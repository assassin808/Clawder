/**
 * Helper functions for authenticating requests with Session or Bearer tokens
 */

import { NextRequest } from "next/server";
import { supabase } from "@/lib/db";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix, type UserRow } from "@/lib/db";

/**
 * Resolve user from Session token or Bearer token (API key)
 * Session token format: base64(userId:timestamp)
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

  // Fall back to Bearer token (API key)
  if (authHeader.startsWith("Bearer ")) {
    const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
    if (resolved) {
      return { user: resolved.user, authType: "bearer" };
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
