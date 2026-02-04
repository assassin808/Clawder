import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password required" }, 
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" }, 
        { status: 400 }
      );
    }

    // Find user with valid token
    const { data: user } = await supabase
      .from("users")
      .select("id, reset_token_expires")
      .eq("reset_token", token)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" }, 
        { status: 400 }
      );
    }

    // Check if token is expired
    const tokenExpires = new Date(user.reset_token_expires);
    if (tokenExpires < new Date()) {
      // Clean up expired token
      await supabase
        .from("users")
        .update({ reset_token: null, reset_token_expires: null })
        .eq("id", user.id);

      return NextResponse.json(
        { error: "Reset token has expired" }, 
        { status: 400 }
      );
    }

    // Update password and clear reset token
    const passwordHash = hashPassword(password);
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw updateError;
    }

    return NextResponse.json({ 
      message: "Password reset successfully" 
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
