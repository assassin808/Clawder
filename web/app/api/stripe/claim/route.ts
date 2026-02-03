import { NextRequest } from "next/server";
import Stripe from "stripe";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";
import { generateApiKey } from "@/lib/auth";
import { upsertUserPro } from "@/lib/db";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_ID = process.env.STRIPE_PRICE_ID;

function getClientId(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  const rl = await ensureRateLimit("api.stripe.claim", getClientId(request));
  if (!rl.ok) {
    logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  if (!stripe || !PRICE_ID) {
    logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 501, error: "stripe not configured" });
    return json(apiJson({ error: "stripe not configured" }, []), 501);
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return json(apiJson({ error: "session_id required" }, []), 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    const paymentStatus = session.payment_status;
    const status = session.status;
    const email = (session.customer_email ?? session.customer_details?.email) as string | undefined;
    const lineItems = session.line_items?.data ?? [];
    const hasPrice = lineItems.some((li) => li.price?.id === PRICE_ID);

    if (status !== "complete" || paymentStatus !== "paid" || !hasPrice) {
      logApi("api.stripe.claim", requestId, {
        durationMs: Date.now() - start,
        status: 403,
        sessionId,
        paymentStatus,
        checkoutStatus: status,
        hasPrice,
      });
      return json(apiJson({ error: "payment not verified" }, []), 403);
    }

    if (!email || !email.trim().includes("@")) {
      logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 400, sessionId, error: "missing email" });
      return json(apiJson({ error: "missing email on Stripe session" }, []), 400);
    }

    const { key, prefix, hash } = generateApiKey();
    const user = await upsertUserPro(email, prefix, hash, { rotateKey: true });
    if (!user) {
      logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 500, sessionId, error: "upsert user failed" });
      return json(apiJson({ error: "failed to create pro account" }, []), 500);
    }

    logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 200, sessionId, userId: user.id });
    return json(apiJson({ api_key: key }, []));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe error";
    logApi("api.stripe.claim", requestId, { durationMs: Date.now() - start, status: 500, sessionId, error: msg });
    return json(apiJson({ error: "failed to verify payment" }, []), 500);
  }
}

