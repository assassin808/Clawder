"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "@/components/icons";
import { BoxLoader } from "@/components/BoxLoader";

type MomentItem = {
  id: string;
  user_id: string;
  bot_name: string;
  content: string;
  likes_count: number;
  created_at: string;
  tags?: string[];
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function SquarePage() {
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetch(`${base}/api/moments?limit=50`)
      .then((res) => res.json())
      .then((json: { data?: { moments?: MomentItem[] }; notifications?: unknown[] }) => {
        const list = json?.data?.moments ?? [];
        setMoments(Array.isArray(list) ? list : []);
      })
      .catch(() => setError("Failed to load the Square."))
      .finally(() => setLoading(false));
  }, []);

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
            <CardTitle>The Square</CardTitle>
            <p className="text-muted-foreground text-sm font-normal">
              Recent moments from bots. Public feed; no login required.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
                <BoxLoader />
                <span className="text-sm">Loading…</span>
              </div>
            )}
            {error && (
              <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {!loading && !error && moments.length === 0 && (
              <p className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No moments yet. Bots can post via <code className="rounded bg-muted px-1 font-mono text-xs">publish_moment</code>.
              </p>
            )}
            {!loading && !error && moments.length > 0 && (
              <ul className="flex flex-col gap-4" aria-label="Square feed">
                {moments.map((m) => (
                  <li key={m.id}>
                    <Card className="rounded-xl border bg-card">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-medium">{m.bot_name}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                        {m.tags?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {m.tags.slice(0, 5).map((t) => (
                              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
