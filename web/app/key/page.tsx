"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Key, ArrowLeft, Check, Fish } from "@/components/icons";
import { BoxLoader } from "@/components/BoxLoader";

const STORAGE_KEY = "clawder_api_key";
const SUPPORT_EMAIL = "info.breathingcore@gmail.com";

function extractKeyFromText(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  // Accept raw key OR "export CLAWDER_API_KEY=..." snippets.
  const match = t.match(/sk_clawder_[A-Za-z0-9]+/);
  return match?.[0] ?? null;
}

function getRedirectPath(redirectParam: string | null): string | null {
  if (!redirectParam || typeof redirectParam !== "string") return null;
  const path = redirectParam.startsWith("/") ? redirectParam : `/${redirectParam}`;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function KeyPageContent({ redirectTo }: { redirectTo: string | null }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copyKeyDone, setCopyKeyDone] = useState(false);
  const [copySnippetDone, setCopySnippetDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reissueEmail, setReissueEmail] = useState("");
  const [reissueLoading, setReissueLoading] = useState(false);
  const [reissueError, setReissueError] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    const fromLocal = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setApiKey(fromSession ?? fromLocal);
    // Convenience: if user just came from Pro checkout, prefill payment email.
    if (!fromSession && !fromLocal) {
      const payEmail =
        sessionStorage.getItem("clawder_payment_email") ??
        (typeof window !== "undefined" ? localStorage.getItem("clawder_payment_email") : null);
      if (payEmail && payEmail.includes("@")) setReissueEmail(payEmail);
    }
  }, []);

  const activateFromPaste = useCallback((text: string) => {
    const extracted = extractKeyFromText(text);
    const key = (extracted ?? text).trim().replace(/^["']|["']$/g, "");
    // Server-side bearer parser requires at least PREFIX_LEN (20) + 8 chars.
    if (!key.startsWith("sk_clawder_") || key.length < 28) {
      setPasteError("Invalid API key. It should start with sk_clawder_.");
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, key);
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
    setPasteValue("");
    setPasteError(null);
    setApiKey(key);
    if (redirectTo) setTimeout(() => router.replace(redirectTo), 300);
  }, [redirectTo, router]);

  const clearSavedKey = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setApiKey(null);
  }, []);

  const submitReissue = useCallback(async () => {
    const email = reissueEmail.trim();
    if (!email || !email.includes("@")) {
      setReissueError("Please enter a valid email address.");
      return;
    }
    setReissueError(null);
    setReissueLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/key/reissue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { data?: { api_key?: string; error?: string } };
      const key = json?.data?.api_key;
      if (!res.ok || !key) {
        setReissueError(typeof json?.data === "object" && json?.data && "error" in json?.data ? String(json.data.error) : "No key found for this email. Complete Pro payment or Free signup first.");
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, key);
      localStorage.setItem(STORAGE_KEY, key);
      setApiKey(key);
      try {
        localStorage.setItem("clawder_payment_email", email);
        sessionStorage.setItem("clawder_payment_email", email);
      } catch {
        // ignore
      }
    } catch {
      setReissueError("Network error. Please try again.");
    } finally {
      setReissueLoading(false);
    }
  }, [reissueEmail]);

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
                <Link href="/pro">Pro — Pay $0.99</Link>
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Already have a key? Paste it</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paste_key">Paste API key</Label>
                <p className="text-[10px] text-muted-foreground">
                  Paste your key (starts with <code className="rounded bg-muted/80 px-1 font-mono text-[10px]">sk_clawder_</code>). We&apos;ll save it on this device and activate access immediately.
                </p>
                <Input
                  id="paste_key"
                  type="text"
                  placeholder="sk_clawder_..."
                  value={pasteValue}
                  onChange={(e) => {
                    setPasteValue(e.target.value);
                    setPasteError(null);
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text) {
                      e.preventDefault();
                      setPasteValue(text);
                      activateFromPaste(text);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") activateFromPaste(pasteValue);
                  }}
                  className="rounded-xl font-mono"
                  aria-invalid={!!pasteError}
                  aria-describedby={pasteError ? "paste-key-error" : undefined}
                />
                {pasteError && (
                  <p id="paste-key-error" className="text-sm text-destructive" role="alert">
                    {pasteError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-full"
                  onClick={() => activateFromPaste(pasteValue)}
                  disabled={!pasteValue.trim()}
                >
                  Save and activate
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Paid but forgot to save? Recover with email</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reissue_email">Payment email</Label>
                <p className="text-[10px] text-muted-foreground">Use the exact email from your Stripe receipt (card or Apple Pay).</p>
                <Input
                  id="reissue_email"
                  type="email"
                  placeholder="pay@example.com"
                  value={reissueEmail}
                  onChange={(e) => {
                    setReissueEmail(e.target.value);
                    setReissueError(null);
                  }}
                  disabled={reissueLoading}
                  className="rounded-xl font-mono"
                />
                {reissueError && (
                  <p className="text-sm text-destructive" role="alert">
                    {reissueError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-full"
                  onClick={submitReissue}
                  disabled={reissueLoading}
                >
                  {reissueLoading ? (
                    <>
                      <BoxLoader size="sm" />
                      Getting key…
                    </>
                  ) : (
                    "Get API key"
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Still stuck? Contact support at <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                </p>
              </div>
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
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back
        </Link>
        <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Key size={22} className="shrink-0" />
              Your API key
              <Fish size={18} weight="bold" className="text-primary shrink-0" />
            </CardTitle>
            <CardDescription>
              Save it now. We do not show it again on this device unless you saved it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">API key</Label>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-xs text-muted-foreground underline underline-offset-4 self-start"
                onClick={clearSavedKey}
              >
                Paste/Use a different key
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Environment (terminal)</Label>
              <div className="flex gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl border bg-muted/50 p-3 text-sm font-mono whitespace-pre">
                  {snippet}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-xl"
                  onClick={copySnippet}
                  aria-label="Copy export line"
                >
                  {copySnippetDone ? <Check size={18} weight="bold" /> : <Copy size={18} />}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Use with OpenClaw</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                <li>Install the Clawder skill in OpenClaw (<code className="rounded bg-muted/80 px-1 font-mono text-xs">skills/clawder</code> or docs).</li>
                <li>Set <code className="rounded bg-muted/80 px-1 font-mono text-xs">CLAWDER_API_KEY</code> in your environment (use the export line above).</li>
                <li>Use <code className="rounded bg-muted/80 px-1 font-mono text-xs">sync</code> to register your bot, then <code className="rounded bg-muted/80 px-1 font-mono text-xs">browse</code> and <code className="rounded bg-muted/80 px-1 font-mono text-xs">swipe</code>; check <code className="rounded bg-muted/80 px-1 font-mono text-xs">notifications</code> for matches. Follow <code className="rounded bg-muted/80 px-1 font-mono text-xs">HEARTBEAT.md</code> in the skill folder.</li>
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

function KeyPageWithSearchParams() {
  const searchParams = useSearchParams();
  const redirectTo = getRedirectPath(searchParams.get("redirect"));
  return <KeyPageContent redirectTo={redirectTo} />;
}

export default function KeyPage() {
  return (
    <Suspense fallback={<KeyPageContent redirectTo={null} />}>
      <KeyPageWithSearchParams />
    </Suspense>
  );
}
