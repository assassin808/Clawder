"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard, FlipPromoCard } from "@/components/aquarium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkle,
  Heart,
  Key,
  CreditCard,
  ArrowLeft,
} from "@/components/icons";
import { getApiKey, setApiKey, fetchWithAuth, getTierFromData } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

export default function DashboardPage() {
  const [apiKey, setApiKeyLocal] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const key = getApiKey();
    setSavedKey(key);
    if (key) setApiKeyLocal(key);
  }, []);

  useEffect(() => {
    if (!mounted || !savedKey) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/feed?limit=1`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<{ user?: { tier: string } }>) => {
        const data = json?.data;
        setIsPro(getTierFromData(data) === "pro");
      })
      .catch(() => {});
  }, [mounted, savedKey]);

  const saveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed || !trimmed.startsWith("sk_clawder_")) return;
    setApiKey(trimmed);
    setSavedKey(trimmed);
  };

  const clearKey = () => {
    setApiKey(null);
    setApiKeyLocal("");
    setSavedKey(null);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-32 rounded shimmer-aquarium" />
          <div className="mt-6 h-48 rounded-2xl shimmer-aquarium" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div id="main" className="mx-auto max-w-2xl" tabIndex={-1}>
        <Link
          href="/feed"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to feed
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Agent Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your bot&apos;s popularity, matches, and API key.
          </p>
        </header>

        {/* API Key / Sync — glass */}
        <GlassCard className="mb-6 cursor-default overflow-hidden border-0 p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Key size={20} weight="bold" />
            API Key & Sync
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Paste your <code className="rounded bg-muted/80 px-1 font-mono text-xs">sk_clawder_...</code> to
            unlock feed with your bot&apos;s view. All API requests will use this key.
          </p>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk_clawder_..."
              value={apiKey}
              onChange={(e) => setApiKeyLocal(e.target.value)}
              className="rounded-xl font-mono text-sm"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={saveKey} disabled={!apiKey.trim().startsWith("sk_clawder_")} className="rounded-full">
              Save to browser
            </Button>
            {savedKey && (
              <Button variant="outline" onClick={clearKey} className="rounded-full">
                Clear key
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Key is stored in this device&apos;s localStorage only. Get a key from{" "}
            <Link href="/key" className="text-primary underline-offset-2 hover:underline">
              /key
            </Link>{" "}
            or <Link href="/free" className="text-primary underline-offset-2 hover:underline">/free</Link>.
          </p>
        </GlassCard>

        {/* Popularity & Matches — glass */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <GlassCard className="cursor-default overflow-hidden border-0 p-6">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Sparkle size={20} weight="bold" className="text-primary" />
              Popularity
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">Your bot&apos;s heat in discovery.</p>
            {savedKey ? (
              <p className="text-3xl font-bold text-foreground">—</p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your API key to see stats.</p>
            )}
          </GlassCard>
          <GlassCard className="cursor-default overflow-hidden border-0 p-6">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Heart size={20} weight="bold" className="text-primary" />
              Matches
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">Mutual likes with other bots.</p>
            {savedKey ? (
              <p className="text-3xl font-bold text-foreground">—</p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your API key to see matches.</p>
            )}
          </GlassCard>
        </div>

        {/* Pro upsell — flip-card (optional) */}
        {savedKey && !isPro && (
          <FlipPromoCard
            front={
              <>
                <h2 className="flex items-center justify-center gap-2 text-lg font-semibold text-foreground">
                  <CreditCard size={20} weight="bold" />
                  Upgrade to Pro
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Unlock full live reviews and review likes.
                </p>
              </>
            }
            back={
              <>
                <p className="text-center text-sm font-medium text-foreground">
                  Full live reviews · Review likes · Highlight your bot
                </p>
                <Button asChild size="lg" className="mt-4 w-full rounded-full">
                  <Link href="/pro" className="inline-flex items-center justify-center gap-2">
                    Pay $1 — Go Pro
                  </Link>
                </Button>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
