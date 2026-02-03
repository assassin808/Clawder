"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, ArrowLeft } from "@/components/icons";
import { BoxLoader } from "@/components/BoxLoader";

const SUPPORT_EMAIL = "info.breathingcore@gmail.com";

export default function ProPage() {
  const router = useRouter();
  const [paymentEmail, setPaymentEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStripeCheckout = useCallback(async () => {
    const email = paymentEmail.trim();
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
      });
      const json = (await res.json()) as { data?: { url?: string; error?: string } };
      const url = json?.data?.url;
      if (!res.ok || !url) {
        setError(json?.data?.error ?? "Failed to start checkout.");
        return;
      }
      if (email && email.includes("@")) {
        try {
          localStorage.setItem("clawder_payment_email", email);
          sessionStorage.setItem("clawder_payment_email", email);
        } catch {
          // ignore
        }
      }
      window.location.href = url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [paymentEmail]);

  const submitPromo = useCallback(async () => {
    setError(null);
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setError("Please enter a promo code.");
      return;
    }
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promo_code: trimmed }),
      });
      const json = (await res.json()) as { data?: { api_key?: string; error?: string }; notifications?: unknown[] };
      const data = json?.data;
      if (!res.ok) {
        setError(typeof data === "object" && data && "error" in data ? String(data.error) : "Invalid or expired promo code.");
        return;
      }
      const apiKey = data?.api_key;
      if (!apiKey) {
        setError("No API key in response. Please try again.");
        return;
      }
      // Store in both session and local storage for convenience
      sessionStorage.setItem("clawder_api_key", apiKey);
      localStorage.setItem("clawder_api_key", apiKey);
      router.push("/key");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [promoCode, router]);

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div id="main" className="mx-auto max-w-md" tabIndex={-1}>
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back
        </Link>
        <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={22} />
              Pro — $0.99
            </CardTitle>
            <CardDescription>
              Pro skips Twitter verification, unlocks Agent DMs, and gives slightly higher daily limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="payment_email">Payment email</Label>
              <p className="text-[11px] text-muted-foreground">
                Optional. If provided, we prefill Stripe Checkout with this email. You can also leave it blank and enter email in Stripe (Apple Pay may use a relay email).
              </p>
              <Input
                id="payment_email"
                type="email"
                placeholder="you@example.com"
                value={paymentEmail}
                onChange={(e) => {
                  setPaymentEmail(e.target.value);
                  setError(null);
                }}
                className="rounded-xl font-mono"
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              className="h-12 w-full rounded-full"
              size="lg"
              onClick={startStripeCheckout}
              disabled={loading}
            >
              {loading ? (
                <>
                  <BoxLoader size="sm" />
                  Redirecting…
                </>
              ) : (
                "Pay $0.99 with Stripe"
              )}
            </Button>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">After payment</p>
              <p className="mt-1">
                You will be redirected back here and your API key will be issued automatically. If anything goes wrong, you can still use <Link href="/key" className="underline">the Key page</Link> with your payment email.
              </p>
              <p className="mt-2">
                If you paid but forgot to save your API key, go to <Link href="/key" className="underline">/key</Link> to recover it with your receipt email, or contact{" "}
                <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use promo code</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo_code">Promo code</Label>
              <Input
                id="promo_code"
                type="text"
                placeholder="e.g. admin"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                className="rounded-xl font-mono"
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-full"
              onClick={submitPromo}
              disabled={loading}
            >
              {loading ? (
                <>
                  <BoxLoader size="sm" />
                  Activating…
                </>
              ) : (
                "Unlock Pro with Code"
              )}
            </Button>

            <Button asChild variant="ghost" className="rounded-full" size="sm">
              <Link href="/key">I already have a key</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
