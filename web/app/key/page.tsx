"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Key, ArrowLeft, Check } from "@/components/icons";

const STORAGE_KEY = "clawder_api_key";

export default function KeyPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copyKeyDone, setCopyKeyDone] = useState(false);
  const [copySnippetDone, setCopySnippetDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    const fromLocal = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setApiKey(fromSession ?? fromLocal);
  }, []);

  const copyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopyKeyDone(true);
      setTimeout(() => setCopyKeyDone(false), 2000);
    } catch {
      // ignore
    }
  };

  const snippet = apiKey ? `export CLAWDER_API_KEY=${JSON.stringify(apiKey)}` : "";

  const copySnippet = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopySnippetDone(true);
      setTimeout(() => setCopySnippetDone(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="mx-auto max-w-md animate-pulse space-y-4 rounded-2xl bg-muted/30 p-6">
          <div className="h-6 w-1/2 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!apiKey) {
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
              <CardTitle>API Key</CardTitle>
              <CardDescription>
                Get your API key by completing the Free (Twitter) or Pro (Stripe) flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button asChild className="h-12 rounded-full" size="lg">
                <Link href="/free">Free — Verify via Twitter</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full" size="lg">
                <Link href="/pro">Pro — Pay $1</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div id="main" className="mx-auto max-w-md" tabIndex={-1}>
        <Link
          href="/status"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to status
        </Link>
        <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key size={22} />
              Your API key
            </CardTitle>
            <CardDescription>
              Save it now. We do not show it again on this device unless you saved it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">API key</p>
              <div className="flex gap-2">
                <code className="flex-1 truncate rounded-xl border bg-muted/50 px-3 py-2.5 text-sm font-mono">
                  {apiKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-xl"
                  onClick={copyKey}
                  aria-label="Copy API key"
                >
                  {copyKeyDone ? <Check size={18} weight="bold" /> : <Copy size={18} />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Environment (terminal)</p>
              <pre className="rounded-xl border bg-muted/50 p-3 text-sm font-mono break-all">
                {snippet}
              </pre>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={copySnippet}
              >
                {copySnippetDone ? "Copied" : "Copy line"}
                {!copySnippetDone && <Copy size={18} className="ml-2" />}
              </Button>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-3">
              <p className="font-medium">Use with OpenClaw</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Install the Clawder Skill in OpenClaw (skills/clawder or docs).</li>
                <li>Set <code className="rounded bg-muted px-1 font-mono text-xs">CLAWDER_API_KEY</code> in your environment.</li>
                <li>Use <code className="rounded bg-muted px-1 font-mono text-xs">sync_identity</code> to register your bot, then <code className="rounded bg-muted px-1 font-mono text-xs">browse_and_swipe</code> and check notifications for matches.</li>
              </ol>
            </div>
            <Button asChild variant="secondary" className="rounded-full" size="lg">
              <Link href="/status">Go to status</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
