"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Masonry } from "@/components/aquarium";
import { cn } from "@/lib/utils";
import {
  FeedCard,
  type FeedItem,
  getFeedSavedIds,
  getFeedHiddenIds,
  setFeedSavedIds,
  setFeedHiddenIds,
} from "@/components/feed/feed-card";
import { FeedSkeletonGrid } from "@/components/feed/feed-skeleton";
import { StaggerReveal } from "@/components/reactbits";
import { UserCircle, Timer } from "@/components/icons";
import { fetchWithAuth, getTierFromData, getViewerUserIdFromData } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

const TAG_PILLS = [
  { label: "Trending", value: "trending" },
  { label: "Best Among Humans", value: "best_humans" },
  { label: "Best Among Bots", value: "best_bots" },
  { label: "Just Matched", value: "just_matched" },
] as const;
const FEED_CACHE_KEY = "feed:cache";
const FEED_SCROLL_KEY = "feed:scrollY";
const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

type FeedCache = { items: FeedItem[]; ts: number; isPro?: boolean; viewer_user_id?: string | null };

function getCachedFeed(): FeedCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedCache;
    if (!Array.isArray(parsed.items) || Date.now() - (parsed.ts || 0) > FEED_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedFeed(items: FeedItem[], isPro?: boolean, viewerUserId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ items, ts: Date.now(), isPro, viewer_user_id: viewerUserId }));
  } catch {}
}

function FeedPageContent() {
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") ?? "";
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  const scrollRestoredRef = useRef(false);

  useEffect(() => {
    setLikedPostIds(getFeedSavedIds()); // Reuse saved storage for liked posts
    setHiddenIds(getFeedHiddenIds());
  }, []);

  const fetchFeed = useCallback(() => {
    setLoading(true);
    setError(null);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const q = new URLSearchParams({ limit: "20" });
    if (tag) q.set("tag", tag);
    fetchWithAuth(`${base}/api/feed?${q.toString()}`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<{ feed_items?: FeedItem[]; user?: { tier: string }; viewer_user_id?: string }>) => {
        const data = json?.data;
        const list = data?.feed_items ?? [];
        const next = Array.isArray(list) ? list : [];
        const pro = getTierFromData(data) === "pro";
        const viewer = getViewerUserIdFromData(data);
        setItems(next);
        setIsPro(pro);
        setViewerUserId(viewer);
        // Initialize liked review IDs from feed data
        const initialLiked = new Set<string>();
        next.forEach((item) => {
          (item.live_reviews ?? item.featured_reviews ?? []).forEach((r) => {
            if (r.viewer_liked) initialLiked.add(r.id);
          });
        });
        setLikedReviewIds(initialLiked);
        if (!tag) setCachedFeed(next, pro, viewer);
      })
      .catch(() => setError("Failed to load the feed."))
      .finally(() => setLoading(false));
  }, [tag]);

  useEffect(() => {
    const cached = !tag ? getCachedFeed() : null;
    if (cached?.items?.length) {
      setItems(cached.items);
      if (cached.isPro !== undefined) setIsPro(cached.isPro);
      if (cached.viewer_user_id !== undefined) setViewerUserId(cached.viewer_user_id);
      setLoading(false);
      requestAnimationFrame(() => {
        const sy = sessionStorage.getItem(FEED_SCROLL_KEY);
        if (sy != null) {
          const y = Number(sy);
          if (Number.isFinite(y)) window.scrollTo(0, y);
        }
      });
      return;
    }
    fetchFeed();
  }, [tag, fetchFeed]);

  const handleLikePost = useCallback((postId: string) => {
    const liked = likedPostIds.has(postId);
    const nextLiked = !liked;

    // Optimistically update
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(postId);
      else next.delete(postId);
      setFeedSavedIds(next); // Persist to localStorage
      return next;
    });

    // TODO: Call API to record human post like
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${postId}/like`, {
      method: "POST",
      body: JSON.stringify({ like: nextLiked }),
    }).catch(() => {
      // Rollback on error
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(postId);
        else next.delete(postId);
        setFeedSavedIds(next);
        return next;
      });
    });
  }, [likedPostIds]);

  const handleLikeReview = useCallback((reviewId: string) => {
    if (!isPro) return;
    const liked = likedReviewIds.has(reviewId);
    const nextLiked = !liked;

    // Optimistically update
    setLikedReviewIds((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(reviewId);
      else next.delete(reviewId);
      return next;
    });

    // Update items with new like count
    setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        live_reviews: (item.live_reviews ?? []).map((r) =>
          r.id === reviewId
            ? { ...r, viewer_liked: nextLiked, likes_count: (r.likes_count ?? 0) + (nextLiked ? 1 : -1) }
            : r
        ),
        featured_reviews: (item.featured_reviews ?? []).map((r) =>
          r.id === reviewId
            ? { ...r, viewer_liked: nextLiked, likes_count: (r.likes_count ?? 0) + (nextLiked ? 1 : -1) }
            : r
        ),
      }))
    );

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/reviews/like`, {
      method: "POST",
      body: JSON.stringify({ review_id: reviewId, like: nextLiked }),
    }).catch(() => {
      // Rollback on error
      setLikedReviewIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(reviewId);
        else next.delete(reviewId);
        return next;
      });
      setItems((prevItems) =>
        prevItems.map((item) => ({
          ...item,
          live_reviews: (item.live_reviews ?? []).map((r) =>
            r.id === reviewId
              ? { ...r, viewer_liked: liked, likes_count: (r.likes_count ?? 0) + (liked ? 1 : -1) }
              : r
          ),
          featured_reviews: (item.featured_reviews ?? []).map((r) =>
            r.id === reviewId
              ? { ...r, viewer_liked: liked, likes_count: (r.likes_count ?? 0) + (liked ? 1 : -1) }
              : r
          ),
        }))
      );
    });
  }, [isPro, likedReviewIds]);

  useEffect(() => {
    const saveScroll = () => {
      if (typeof window === "undefined") return;
      sessionStorage.setItem(FEED_SCROLL_KEY, String(window.scrollY));
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => window.removeEventListener("scroll", saveScroll);
  }, []);

  useEffect(() => {
    const onLeave = () => {
      if (typeof window === "undefined") return;
      sessionStorage.setItem(FEED_SCROLL_KEY, String(window.scrollY));
      if (items.length > 0 && !tag) setCachedFeed(items, isPro, viewerUserId);
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [items, tag, isPro, viewerUserId]);

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
        {/* Tag rail — filter by tag, URL query driven */}
        <div className="scrollbar-hide overflow-x-auto border-t border-border/30">
          <div className="flex gap-2 px-4 py-2">
            {TAG_PILLS.map((p) => {
              const isActive = (tag === "" && p.value === "trending") || tag === p.value;
              return (
                <Link
                  key={p.value}
                  href={p.value === "trending" ? "/feed" : `/feed?tag=${encodeURIComponent(p.value)}`}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15" : "bg-muted/80 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {p.label}
                </Link>
              );
            })}
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
            {items
              .filter((item) => !hiddenIds.has(item.post.id))
              .map((item, index) => (
                <StaggerReveal key={item.post.id} index={index} staggerMs={50}>
                  <FeedCard
                    item={item}
                    isPro={isPro}
                    viewerUserId={viewerUserId}
                    isLiked={likedPostIds.has(item.post.id)}
                    onLikePost={handleLikePost}
                    onHide={(postId) => {
                      const next = new Set(hiddenIds);
                      next.add(postId);
                      setHiddenIds(next);
                      setFeedHiddenIds(next);
                    }}
                    onLikeReview={handleLikeReview}
                  />
                </StaggerReveal>
              ))}
          </Masonry>
        )}
      </main>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedSkeletonGrid count={6} />}>
      <FeedPageContent />
    </Suspense>
  );
}
