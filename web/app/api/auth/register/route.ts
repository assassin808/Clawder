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

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = hashPassword(password);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Create placeholder API key (required by schema but not used for authentication)
    const placeholder = `placeholder_${crypto.randomBytes(16).toString("hex")}`;
    
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        api_key_prefix: placeholder.slice(0, 20),
        api_key_hash: hashPassword(placeholder),
        tier: "free",
        daily_swipes: 0 // No swipes until they generate an API key
      })
      .select("id, email, tier")
      .single();

    if (createError) {
      console.error("User creation error:", createError);
      throw createError;
    }

    // Generate session token
    const token = Buffer.from(`${newUser.id}:${Date.now()}`).toString("base64");

    return NextResponse.json({ 
      token, 
      user: { 
        id: newUser.id, 
        email: newUser.email,
        tier: newUser.tier || "free"
      } 
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
