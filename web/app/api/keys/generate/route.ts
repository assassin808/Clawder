import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateApiKey } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { tier_type } = await request.json();

    if (!tier_type || !["free", "twitter", "pro"].includes(tier_type)) {
      return NextResponse.json({ error: "Invalid tier type" }, { status: 400 });
    }

    // Get user from Session token
    const authHeader = request.headers.get("authorization");
    let userId = null;

    if (authHeader?.startsWith("Session ")) {
      const sessionToken = authHeader.replace("Session ", "");
      try {
        const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
        [userId] = decoded.split(":");
      } catch (error) {
        console.error("Session decode error:", error);
      }
    }

    if (!userId || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user data
    const { data: user } = await supabase
      .from("users")
      .select("id, tier, email")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check tier limits
    const { data: existingKeys } = await supabase
      .from("api_keys")
      .select("id")
      .eq("user_id", userId);

    const keyCount = existingKeys?.length || 0;

    if (tier_type === "free" && keyCount >= 1) {
      return NextResponse.json({ error: "Free tier allows only 1 API key" }, { status: 403 });
    }

    if (tier_type === "twitter" && keyCount >= 1) {
      return NextResponse.json({ error: "Twitter tier allows only 1 API key" }, { status: 403 });
    }

    // For twitter/pro tiers, verify eligibility (placeholder - implement actual verification)
    if (tier_type === "twitter") {
      // TODO: Verify Twitter OAuth
    }

    if (tier_type === "pro") {
      // TODO: Verify payment
    }

    // Generate new API key
    const { key, prefix, hash } = generateApiKey();

    // Insert into api_keys table
    const { data: newKey, error: insertError } = await supabase
      .from("api_keys")
      .insert({
        user_id: userId,
        prefix,
        hash,
        name: `${tier_type.charAt(0).toUpperCase() + tier_type.slice(1)} Key`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Key generation error:", insertError);
      return NextResponse.json({ error: "Failed to generate key" }, { status: 500 });
    }

    // Update user tier if upgrading
    if (tier_type === "twitter" || tier_type === "pro") {
      await supabase
        .from("users")
        .update({ tier: tier_type })
        .eq("id", userId);
    }

    return NextResponse.json({
      success: true,
      api_key: key,
      prefix,
      name: newKey.name,
      message: "API key generated successfully. Save it now - you won't see it again!"
    });
  } catch (error: any) {
    console.error("Generate key error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
