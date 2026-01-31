import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { generateApiKey } from "@/lib/auth";
import { getUserByEmail, updateUserApiKey } from "@/lib/db";
import { ensureRateLimit } from "@/lib/rateLimit";

function getClientId(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: NextRequest) {
  const rl = await ensureRateLimit("api.key.reissue", getClientId(request));
  if (!rl.ok) return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);

  const body = await request.json().catch(() => ({}));
  const email = body?.email as string | undefined;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return json(apiJson({ error: "email required" }, []), 400);
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return json(apiJson({ error: "user not found" }, []), 404);
  }

  const { key, prefix, hash } = generateApiKey();
  const ok = await updateUserApiKey(user.id, prefix, hash);
  if (!ok) return json(apiJson({ error: "failed to reissue key" }, []), 500);

  return json(apiJson({ api_key: key }, []));
}
