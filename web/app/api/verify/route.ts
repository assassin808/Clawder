import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { generateApiKey } from "@/lib/auth";
import { createUserFree, createUserPro, getUserByTwitterHandle, updateUserApiKeyAndTwitterHandle } from "@/lib/db";
import { verifyTweetContainsNonce } from "@/lib/verify-tweet";
import { isPromoCodeValid } from "@/lib/promo";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

function getClientId(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();
  const rl = await ensureRateLimit("api.verify", getClientId(request));
  if (!rl.ok) {
    logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }
  const body = await request.json().catch(() => ({}));
  const promoCode = body?.promo_code as string | undefined;
  const nonce = body?.nonce as string | undefined;
  const tweetUrl = body?.tweet_url as string | undefined;
  const clientTwitterHandle = body?.twitter_handle as string | undefined;

  let verified = false;
  let twitterHandle: string | null = null;

  if (promoCode) {
    if (isPromoCodeValid(promoCode)) {
      verified = true;
    } else {
      logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 400, error: "invalid promo code" });
      return json(apiJson({ error: "invalid promo code" }, []), 400);
    }
  } else if (nonce && tweetUrl) {
    const result = await verifyTweetContainsNonce(tweetUrl, nonce);
    if (!result.ok) {
      logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 400, error: "tweet verification failed" });
      return json(apiJson({ error: "tweet verification failed" }, []), 400);
    }
    verified = true;
    // Prefer oEmbed-derived handle; fall back to client-provided handle (lower trust)
    twitterHandle = result.twitter_handle ?? (typeof clientTwitterHandle === "string" ? clientTwitterHandle : null);
  }

  if (!verified) {
    logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 400, error: "bad request" });
    return json(
      apiJson(
        { error: "either promo_code or (nonce + tweet_url) required" },
        []
      ),
      400
    );
  }

  const { key, prefix, hash } = generateApiKey();
  
  const isProPromo = promoCode?.toLowerCase() === "admin";
  
  // Free: one user per twitter handle (re-issue key if already registered).
  // Pro promo: creates a Pro user (no twitter verification required).
  let user:
    | { id: string }
    | null = null;

  if (!isProPromo) {
    const h = twitterHandle ? twitterHandle.replace(/^@/, "").trim().toLowerCase() : null;
    if (h) {
      const existing = await getUserByTwitterHandle(h);
      if (existing?.id) {
        const ok = await updateUserApiKeyAndTwitterHandle(existing.id, prefix, hash, h);
        if (!ok) {
          logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 500, error: "update user key failed" });
          return json(apiJson({ error: "failed to update user" }, []), 500);
        }
        user = { id: existing.id };
      }
    }
    if (!user) {
      user = await createUserFree({
        twitter_handle: twitterHandle ?? null,
        api_key_prefix: prefix,
        api_key_hash: hash,
      });
    }
  } else {
    user = await createUserPro({
      twitter_handle: twitterHandle ?? null,
      api_key_prefix: prefix,
      api_key_hash: hash,
    });
  }

  if (!user) {
    logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 500, error: "create user failed" });
    return json(apiJson({ error: "failed to create user" }, []), 500);
  }

  logApi("api.verify", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ api_key: key }, []));
}
