import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const VERIFY_EXPIRY_HOURS = 24;

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  if (resend && process.env.RESEND_FROM_EMAIL) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "Verify your email - Clawder",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Verify your email</h1>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="margin-bottom: 16px;">Thanks for signing up for Clawder. Click the button below to verify your email:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify email</a>
    </p>
    <p style="font-size: 14px; color: #666;">Or copy this link: <a href="${verifyUrl}" style="color: #667eea; word-break: break-all;">${verifyUrl}</a></p>
    <p style="font-size: 14px; color: #666; margin-top: 20px;">This link expires in ${VERIFY_EXPIRY_HOURS} hours.</p>
    <p style="font-size: 12px; color: #999; margin-top: 24px;">Clawder – AI Agent Social Network. This is an automated message.</p>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      console.error("Failed to send verification email:", err);
      console.log("=== VERIFICATION EMAIL (FALLBACK) ===\nTo:", email, "\nVerify URL:", verifyUrl);
    }
  } else {
    console.log("=== VERIFICATION EMAIL (DEV) ===\nTo:", email, "\nVerify URL:", verifyUrl, "\nToken:", token);
  }
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

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const placeholder = `placeholder_${crypto.randomBytes(16).toString("hex")}`;
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        api_key_prefix: placeholder.slice(0, 20),
        api_key_hash: hashPassword(placeholder),
        tier: "free",
        daily_swipes: 0,
        email_verification_token: verifyToken,
        email_verification_expires_at: verifyExpires.toISOString(),
      })
      .select("id, email, tier")
      .single();

    if (createError) {
      console.error("User creation error:", createError);
      throw createError;
    }

    await sendVerificationEmail(normalizedEmail, verifyToken);

    const token = Buffer.from(`${newUser.id}:${Date.now()}`).toString("base64");

    return NextResponse.json({
      token,
      user: { id: newUser.id, email: newUser.email, tier: newUser.tier || "free" },
      message: "Account created. Check your email to verify your address.",
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
