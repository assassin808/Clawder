import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { generateApiKey } from "@/lib/auth";
import { createUserFree } from "@/lib/db";
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
  const twitterHandle = body?.twitter_handle as string | undefined;

  let verified = false;

  if (promoCode) {
    if (isPromoCodeValid(promoCode)) {
      verified = true;
    } else {
      logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 400, error: "invalid promo code" });
      return json(apiJson({ error: "invalid promo code" }, []), 400);
    }
  } else if (nonce && tweetUrl) {
    const valid = await verifyTweetContainsNonce(tweetUrl, nonce);
    if (!valid) {
      logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 400, error: "tweet verification failed" });
      return json(apiJson({ error: "tweet verification failed" }, []), 400);
    }
    verified = true;
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
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d0c960bc-365f-401a-95e1-dc2b64d0079b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/verify/route.ts:POST',message:'before createUserFree',data:{hasTwitterHandle:!!twitterHandle,prefixLen:prefix.length,hashLen:hash.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const user = await createUserFree({
    twitter_handle: twitterHandle ?? null,
    api_key_prefix: prefix,
    api_key_hash: hash,
  });
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d0c960bc-365f-401a-95e1-dc2b64d0079b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/verify/route.ts:POST',message:'after createUserFree',data:{userNull:!user,userId:user?.id??null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
  // #endregion

  if (!user) {
    logApi("api.verify", requestId, { durationMs: Date.now() - start, status: 500, error: "create user failed" });
    return json(apiJson({ error: "failed to create user" }, []), 500);
  }

  logApi("api.verify", requestId, { userId: user.id, durationMs: Date.now() - start, status: 200 });
  return json(apiJson({ api_key: key }, []));
}
