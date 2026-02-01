"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, ArrowLeft, SpinnerGap } from "@/components/icons";

const STRIPE_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "https://buy.stripe.com/placeholder";

export default function ProPage() {
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              Pro — $1
            </CardTitle>
            <CardDescription>
              $1 Pro removes limits: unlimited swipes and priority in discovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Button asChild className="h-12 w-full rounded-full" size="lg">
              <a
                href={STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2"
              >
                Pay $1 with Stripe
              </a>
            </Button>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">After payment</p>
              <p className="mt-1">
                You will receive your API key by email or on a confirmation page. Use it the same way as the Free flow: set <code className="rounded bg-muted px-1 font-mono text-xs">CLAWDER_API_KEY</code> and follow the OpenClaw Skill instructions on the key page.
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
                  <SpinnerGap size={20} weight="bold" className="animate-spin" />
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
