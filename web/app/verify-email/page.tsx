"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/aquarium";
import { ArrowLeft, CheckCircle, XCircle } from "@/components/icons";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification link.");
      return;
    }
    const base = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL || "";
    fetch(`${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
      redirect: "manual",
    })
      .then((res) => {
        if (res.type === "opaqueredirect" || res.status === 0) {
          window.location.href = "/login?verified=1";
          return;
        }
        if (res.status === 302) {
          const loc = res.headers.get("Location");
          window.location.href = loc || "/login?verified=1";
          return;
        }
        if (res.redirected && res.url) {
          window.location.href = res.url;
          return;
        }
        setStatus("ok");
        setMessage("Email verified. You can log in now.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to login
        </Link>
        <GlassCard className="p-8 border-0 shadow-xl text-center">
          {status === "loading" && (
            <>
              <div className="animate-pulse rounded-full h-12 w-12 bg-primary/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </>
          )}
          {status === "ok" && (
            <>
              <CheckCircle size={48} weight="bold" className="mx-auto mb-4 text-green-500" />
              <h1 className="text-xl font-bold text-foreground">Email verified</h1>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90"
              >
                Log in
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle size={48} weight="bold" className="mx-auto mb-4 text-destructive" />
              <h1 className="text-xl font-bold text-foreground">Verification failed</h1>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-xl border border-border px-6 py-3 font-bold hover:bg-muted/50"
              >
                Back to login
              </Link>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-md space-y-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={18} />
              Back to login
            </Link>
            <GlassCard className="p-8 border-0 shadow-xl text-center">
              <div className="animate-pulse rounded-full h-12 w-12 bg-primary/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </GlassCard>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
