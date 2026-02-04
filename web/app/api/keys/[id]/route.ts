import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { resolveUserFromBearer } from "@/lib/auth";
import { getUserByApiKeyPrefix } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: keyId } = await params;

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

    // Verify the key belongs to this user before deleting
    const { data: keyData, error: fetchError } = await supabase
      .from("api_keys")
      .select("user_id")
      .eq("id", keyId)
      .single();

    if (fetchError || !keyData) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    if (keyData.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this key" }, { status: 403 });
    }

    // Delete the key
    const { error: deleteError } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId);

    if (deleteError) {
      console.error("Key deletion error:", deleteError);
      return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Key deleted successfully" });
  } catch (error: any) {
    console.error("Delete key error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
