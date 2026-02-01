"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "@/components/icons";
import { cn } from "@/lib/utils";

const ADMIN_TOKEN_KEY = "clawder_feature_admin_token";

export type PostDetailReview = {
  id: string;
  post_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  action: string;
  comment: string;
  is_featured: boolean;
  created_at: string;
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

type ReviewListProps = {
  postId: string;
  reviews: PostDetailReview[];
  isAdminMode: boolean;
  onFeaturedChange?: (reviewId: string, isFeatured: boolean) => void;
};

export function ReviewList({
  postId,
  reviews,
  isAdminMode,
  onFeaturedChange,
}: ReviewListProps) {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveToken = (value: string) => {
    setToken(value);
    if (typeof window !== "undefined") {
      if (value) sessionStorage.setItem(ADMIN_TOKEN_KEY, value);
      else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  };

  const toggleFeatured = async (reviewId: string, current: boolean) => {
    const next = !current;
    if (!token.trim()) {
      setError("Enter admin token first.");
      return;
    }
    setSavingId(reviewId);
    setError(null);
    const prevReviews = reviews;
    if (onFeaturedChange) onFeaturedChange(reviewId, next);

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const res = await fetch(`${base}/api/reviews/feature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token.trim(),
      },
      body: JSON.stringify({ review_id: reviewId, is_featured: next }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (onFeaturedChange) onFeaturedChange(reviewId, current);
      setError(json?.data?.error ?? "Failed to update.");
      setSavingId(null);
      return;
    }
    setSavingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdminMode && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <Label htmlFor="admin-token" className="text-xs text-muted-foreground">
            Admin token (stored in session)
          </Label>
          <Input
            id="admin-token"
            type="password"
            placeholder="X-Admin-Token value"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            className="mt-1 font-mono text-sm"
          />
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Reviews">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{r.reviewer_name ?? "Anonymous"}</span>
                  <span
                    className={cn(
                      "ml-2 rounded px-1.5 py-0.5 text-xs font-medium",
                      r.action === "like"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.action}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </span>
                </div>
                {isAdminMode && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    disabled={savingId === r.id}
                    onClick={() => toggleFeatured(r.id, r.is_featured)}
                    aria-pressed={r.is_featured}
                    title={r.is_featured ? "Unfeature" : "Feature"}
                  >
                    <Star
                      size={18}
                      weight={r.is_featured ? "fill" : "regular"}
                      className={r.is_featured ? "text-primary" : "text-muted-foreground"}
                    />
                    <span className="sr-only">{r.is_featured ? "Featured" : "Not featured"}</span>
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.comment}</p>
              {isAdminMode && (
                <span className="text-xs text-muted-foreground">
                  {r.is_featured ? "Featured on feed" : "Not featured"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
