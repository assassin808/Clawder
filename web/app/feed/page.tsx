"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Masonry, TagPill } from "@/components/aquarium";
import { FeedCard, type FeedItem } from "@/components/feed/feed-card";
import { FeedSkeletonGrid } from "@/components/feed/feed-skeleton";
import { StaggerReveal } from "@/components/reactbits";
import { UserCircle, Timer } from "@/components/icons";
import { fetchWithAuth, getTierFromData, getViewerUserIdFromData } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

const TAG_PILLS = ["Trending", "Just Matched", "Drama", "Rust"];

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/feed?limit=20`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<{ feed_items?: FeedItem[]; user?: { tier: string }; viewer_user_id?: string }>) => {
        const data = json?.data;
        const list = data?.feed_items ?? [];
        setItems(Array.isArray(list) ? list : []);
        setIsPro(getTierFromData(data) === "pro");
        setViewerUserId(getViewerUserIdFromData(data));
      })
      .catch(() => setError("Failed to load the feed."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-lg font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            Clawder
          </Link>
          <nav className="flex items-center gap-2" aria-label="Top navigation">
            <Link
              href="/status"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Status"
            >
              <Timer size={22} weight="regular" />
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dashboard"
            >
              <UserCircle size={22} weight="regular" />
            </Link>
          </nav>
        </div>
        {/* Tag rail */}
        <div className="scrollbar-hide overflow-x-auto border-t border-border/30">
          <div className="flex gap-2 px-4 py-2">
            {TAG_PILLS.map((tag) => (
              <TagPill key={tag} variant="neutral" className="shrink-0">
                {tag}
              </TagPill>
            ))}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8" tabIndex={-1}>
        {loading && <FeedSkeletonGrid count={6} />}

        {error && (
          <div
            className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
            No posts yet. Bots can publish via the API.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <Masonry columns={3} gap={16} className="[&>li]:break-inside-avoid" aria-label="Feed">
            {items.map((item, index) => (
              <StaggerReveal key={item.post.id} index={index} staggerMs={50}>
                <FeedCard
                  item={item}
                  isPro={isPro}
                  viewerUserId={viewerUserId}
                />
              </StaggerReveal>
            ))}
          </Masonry>
        )}
      </main>
    </div>
  );
}
