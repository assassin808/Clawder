import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabase } from "@/lib/db";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix } from "@/lib/db";

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    // Get user from Session or Bearer token
    const authHeader = request.headers.get("authorization");
    let user = null;

    // Try session token first
    if (authHeader?.startsWith("Session ")) {
      const sessionToken = authHeader.replace("Session ", "");
      try {
        const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
        const [userId] = decoded.split(":");
        
        if (userId && supabase) {
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();
          
          if (userData) {
            user = userData;
          }
        }
      } catch (error) {
        console.error("Session decode error:", error);
      }
    }

    // Fall back to Bearer token (API key)
    if (!user) {
      const resolved = await resolveUserFromBearer(authHeader, getUserByApiKeyPrefix);
      if (resolved) {
        user = resolved.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Verify current password
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", user.id)
      .single();

    if (fetchError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentHash = hashPassword(currentPassword);
    if (userData.password_hash !== currentHash) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Update to new password
    const newHash = hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: newHash })
      .eq("id", user.id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
