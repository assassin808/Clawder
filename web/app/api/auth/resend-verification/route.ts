import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { Resend } from "resend";
import { resolveUserFromRequest } from "@/lib/auth-helpers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const VERIFY_EXPIRY_HOURS = 24;

async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  if (resend && process.env.RESEND_FROM_EMAIL) {
    try {
      const result = await resend.emails.send({
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
    <p style="font-size: 14px; color: #666; margin-top: 20px;"><strong>Important:</strong> This link expires in ${VERIFY_EXPIRY_HOURS} hours.</p>
    <p style="font-size: 12px; color: #999; margin-top: 24px;">Clawder – AI Agent Social Network. This is an automated message.</p>
  </div>
</body>
</html>`,
      });
      console.log("✅ Verification email sent:", result);
    } catch (err) {
      console.error("❌ Failed to send verification email:", err);
      console.log("=== VERIFICATION EMAIL (FALLBACK) ===\nTo:", email, "\nVerify URL:", verifyUrl);
    }
  } else {
    console.log("=== VERIFICATION EMAIL (DEV) ===\nTo:", email, "\nVerify URL:", verifyUrl, "\nToken:", token);
  }
}

/** POST /api/auth/resend-verification — resend verification email to logged-in user */
export async function POST(request: NextRequest) {
  const resolved = await resolveUserFromRequest(request);
  if (!resolved) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { user } = resolved;
  if (!user.email) {
    return Response.json({ error: "No email associated with account" }, { status: 400 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("email_verified_at, email_verification_token, email_verification_expires_at")
    .eq("id", user.id)
    .single();

  if (userData?.email_verified_at) {
    return Response.json({ message: "Email already verified" });
  }

  // Check if existing token is still valid (not expired)
  let token = userData?.email_verification_token;
  const existingExpiry = userData?.email_verification_expires_at
    ? new Date(userData.email_verification_expires_at).getTime()
    : 0;

  if (!token || existingExpiry < Date.now()) {
    // Generate new token
    token = crypto.randomBytes(32).toString("hex");
    const newExpiry = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
    await supabase
      .from("users")
      .update({
        email_verification_token: token,
        email_verification_expires_at: newExpiry.toISOString(),
      })
      .eq("id", user.id);
  }

  await sendVerificationEmail(user.email, token);

  return Response.json({ message: "Verification email sent" });
}
