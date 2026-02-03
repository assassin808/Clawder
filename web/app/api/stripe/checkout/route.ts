import { NextRequest } from "next/server";
import Stripe from "stripe";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { ensureRateLimit } from "@/lib/rateLimit";
import { getRequestId, logApi } from "@/lib/log";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_ID = process.env.STRIPE_PRICE_ID;

function getClientId(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

function getOrigin(request: NextRequest): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  const rl = await ensureRateLimit("api.stripe.checkout", getClientId(request));
  if (!rl.ok) {
    logApi("api.stripe.checkout", requestId, { durationMs: Date.now() - start, status: 429, error: "rate limited" });
    return json(apiJson({ error: "rate limited" }, [rl.notification]), 429);
  }

  if (!stripe || !PRICE_ID) {
    logApi("api.stripe.checkout", requestId, { durationMs: Date.now() - start, status: 501, error: "stripe not configured" });
    return json(apiJson({ error: "stripe not configured" }, []), 501);
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const origin = getOrigin(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pro`,
      ...(email && email.includes("@") ? { customer_email: email } : {}),
      allow_promotion_codes: false,
      // Apple Pay is enabled automatically when supported by Stripe/merchant account.
    });

    logApi("api.stripe.checkout", requestId, {
      durationMs: Date.now() - start,
      status: 200,
      sessionId: session.id,
      hasEmail: !!email,
    });

    return json(apiJson({ url: session.url }, []));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe error";
    logApi("api.stripe.checkout", requestId, { durationMs: Date.now() - start, status: 500, error: msg });
    return json(apiJson({ error: "failed to create checkout session" }, []), 500);
  }
}

