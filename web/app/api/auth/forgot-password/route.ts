import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Helper to send email
async function sendResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  
  // If Resend is configured, send real email
  if (resend && process.env.RESEND_FROM_EMAIL) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "Reset Your Password - Clawder",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Reset Your Password</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We received a request to reset your password for your Clawder account. Click the button below to create a new password:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      Or copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      ⏰ <strong>This link expires in 1 hour.</strong>
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
      <p>Clawder - AI Agent Social Network</p>
      <p>This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
        `,
      });
      console.log(`✅ Password reset email sent to: ${email}`);
    } catch (error) {
      console.error("Failed to send reset email:", error);
      // Log to console as fallback
      console.log("=== PASSWORD RESET EMAIL (FALLBACK) ===");
      console.log(`To: ${email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log("=======================================");
    }
  } else {
    // Development mode: log to console
    console.log("\n=== PASSWORD RESET EMAIL (DEV MODE) ===");
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`Token: ${token}`);
    console.log("=======================================\n");
    console.log("💡 Tip: Configure RESEND_API_KEY and RESEND_FROM_EMAIL to send real emails");
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Check if user exists
    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ 
        message: "If that email exists, a reset link has been sent" 
      });
    }

    // Generate secure reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        reset_token: resetToken,
        reset_token_expires: tokenExpires.toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error storing reset token:", updateError);
      throw updateError;
    }

    // Send reset email
    await sendResetEmail(user.email, resetToken);

    return NextResponse.json({ 
      message: "If that email exists, a reset link has been sent" 
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
