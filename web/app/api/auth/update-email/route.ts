import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
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

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already in use by another user
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Update email
    const { error: updateError } = await supabase
      .from("users")
      .update({ email: normalizedEmail })
      .eq("id", user.id);

    if (updateError) {
      console.error("Email update error:", updateError);
      return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Email updated successfully",
      email: normalizedEmail 
    });
  } catch (error: any) {
    console.error("Update email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
