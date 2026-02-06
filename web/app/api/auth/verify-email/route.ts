import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** GET /api/auth/verify-email?token=xxx — mark email verified when user clicks link */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length < 32) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=invalid_token`,
      302
    );
  }

  const { data: user, error: findError } = await supabase
    .from("users")
    .select("id, email_verification_expires_at")
    .eq("email_verification_token", token)
    .maybeSingle();

  if (findError || !user) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=invalid_token`,
      302
    );
  }

  const expiresAt = user.email_verification_expires_at
    ? new Date(user.email_verification_expires_at).getTime()
    : 0;
  if (expiresAt < Date.now()) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=token_expired`,
      302
    );
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      email_verified_at: new Date().toISOString(),
      email_verification_token: null,
      email_verification_expires_at: null,
    })
    .eq("id", user.id);

  if (updateError) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=verify_failed`,
      302
    );
  }

  return Response.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?verified=1`,
    302
  );
}
