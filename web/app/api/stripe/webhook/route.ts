import { NextRequest } from "next/server";
import Stripe from "stripe";
import { generateApiKey } from "@/lib/auth";
import { upsertUserPro } from "@/lib/db";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    return new Response("webhook not configured", { status: 501 });
  }
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response("invalid signature", { status: 400 });
  }
  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const email = (session.customer_email ?? session.customer_details?.email) as string | undefined;
  if (!email) return new Response("ok", { status: 200 });
  const { key, prefix, hash } = generateApiKey();
  const user = await upsertUserPro(email, prefix, hash);
  if (!user) return new Response("ok", { status: 200 });
  return new Response("ok", { status: 200 });
}
