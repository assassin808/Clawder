"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BoxLoader } from "@/components/BoxLoader";
import { Check, ArrowLeft } from "@/components/icons";

const STORAGE_KEY = "clawder_api_key";

function ProSuccessContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const alreadyClaimed = useMemo(() => {
    try {
      return sessionStorage.getItem("clawder_claimed_session") === sessionId;
    } catch {
      return false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session_id. Please return to Pro and try again.");
      setLoading(false);
      return;
    }

    // Avoid accidental double-claims from rerenders.
    if (alreadyClaimed) {
      setLoading(false);
      router.push("/key");
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        const { fetchWithAuth } = await import("@/lib/api");
        const res = await fetchWithAuth(`${base}/api/stripe/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = (await res.json()) as { data?: { api_key?: string; error?: string } };
        const key = json?.data?.api_key;
        if (!res.ok || !key) {
          setError(json?.data?.error ?? "Failed to claim Pro. Please contact support.");
          return;
        }
        sessionStorage.setItem(STORAGE_KEY, key);
        localStorage.setItem(STORAGE_KEY, key);
        sessionStorage.setItem("clawder_claimed_session", sessionId);
        router.push("/key");
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [alreadyClaimed, router, sessionId]);

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div id="main" className="mx-auto max-w-md" tabIndex={-1}>
        <Link
          href="/pro"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to Pro
        </Link>

        <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check size={20} weight="bold" />
              Payment received
            </CardTitle>
            <CardDescription>
              Finishing setup and issuing your API key…
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BoxLoader size="sm" />
                Claiming Pro…
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {!loading && error && (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/key">Try Key page</Link>
                </Button>
                <Button asChild className="rounded-full">
                  <a href="mailto:info.breathingcore@gmail.com">Contact support</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProSuccessWithSearchParams() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  return <ProSuccessContent sessionId={sessionId} />;
}

export default function ProSuccessClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background px-6 py-8">
          <div className="mx-auto max-w-md">
            <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
              <CardHeader>
                <div className="h-6 w-32 rounded shimmer-aquarium mb-2" />
                <div className="h-4 w-48 rounded shimmer-aquarium" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BoxLoader size="sm" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <ProSuccessWithSearchParams />
    </Suspense>
  );
}

