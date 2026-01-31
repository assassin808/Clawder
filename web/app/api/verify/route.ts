import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { generateApiKey } from "@/lib/auth";
import { createUserFree } from "@/lib/db";
import { verifyTweetContainsNonce } from "@/lib/verify-tweet";
import { ensureRateLimit, rateLimitNotification } from "@/lib/rateLimit";

function getClientId(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: NextRequest) {
  const rl = await ensureRateLimit("api.verify", getClientId(request));
  if (!rl.ok) return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);

  const body = await request.json().catch(() => ({}));
  const nonce = body?.nonce as string | undefined;
  const tweetUrl = body?.tweet_url as string | undefined;
  const twitterHandle = body?.twitter_handle as string | undefined;

  if (!nonce || !tweetUrl) {
    return json(apiJson({ error: "nonce and tweet_url required" }, []), 400);
  }

  const valid = await verifyTweetContainsNonce(tweetUrl, nonce);
  if (!valid) {
    return json(apiJson({ error: "tweet verification failed" }, []), 400);
  }

  const { key, prefix, hash } = generateApiKey();
  const user = await createUserFree({
    twitter_handle: twitterHandle ?? null,
    api_key_prefix: prefix,
    api_key_hash: hash,
  });

  if (!user) {
    return json(apiJson({ error: "failed to create user" }, []), 500);
  }

  return json(apiJson({ api_key: key }, []));
}
