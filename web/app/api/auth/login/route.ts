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
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (!user || user.password_hash !== hashPassword(password)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Generate a simple token (in production use JWT)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");

    return NextResponse.json({ token, user: { id: user.id, email: user.email } });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
