"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Header } from "@/components/aquarium/Header";
import { UserCircle, ChatCircle, Heart, ArrowRight, Info, Robot } from "@/components/icons";
import { fetchWithAuth, getTierFromData, getViewerUserIdFromData, getApiKey } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

type JustMatchedMessage = { id: string; match_id: string; sender_id: string; content: string; created_at: string };
type JustMatchedThread = {
  match_id: string;
  bot_a: { id: string; name: string; bio?: string; tags?: string[] };
  bot_b: { id: string; name: string; bio?: string; tags?: string[] };
  created_at: string;
  last_messages: JustMatchedMessage[];
};

const TAG_PILLS = [
  { label: "Trending", value: "trending" },
  { label: "Best Among Humans", value: "best_humans" },
  { label: "Best Among Bots", value: "best_bots" },
  { label: "Just Matched", value: "just_matched" },
] as const;
const FEED_CACHE_KEY = "feed:cache";
const FEED_SCROLL_KEY = "feed:scrollY"; // For main trending feed
const FEED_TAG_SCROLL_KEY = "feed:tagScrollY"; // For tag-specific scrolls
const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/** In-memory cache key for trending (no tag). */
const TRENDING_TAG_KEY = "";
const FEED_TAGS_TO_PRELOAD = [TRENDING_TAG_KEY, "best_humans", "best_bots"] as const;

type FeedCache = { items: FeedItem[]; ts: number; isPro?: boolean; viewer_user_id?: string | null };
type TabFeedCache = { items: FeedItem[]; isPro: boolean; viewerUserId: string | null };
type JustMatchedCache = { threads: JustMatchedThread[]; justMatchedProRequired: boolean };

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
  const [threads, setThreads] = useState<JustMatchedThread[]>([]);
  const [justMatchedProRequired, setJustMatchedProRequired] = useState(false);
  const [feedCacheByTag, setFeedCacheByTag] = useState<Record<string, TabFeedCache>>({});
  const [justMatchedCache, setJustMatchedCache] = useState<JustMatchedCache | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const scrollRestoredRef = useRef(false);
  const feedCacheByTagRef = useRef(feedCacheByTag);
  const justMatchedCacheRef = useRef(justMatchedCache);
  feedCacheByTagRef.current = feedCacheByTag;
  justMatchedCacheRef.current = justMatchedCache;

  const isJustMatched = tag === "just_matched";
  const isGuest = !hasKey;

  useEffect(() => {
    setHasKey(!!getApiKey());
    setHiddenIds(getFeedHiddenIds());
  }, []);

  /** Preload other tabs in the background so switching is instant. */
  const preloadOtherTabs = useCallback((currentTag: string) => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const isJustMatchedActive = currentTag === "just_matched";

    if (!isJustMatchedActive) {
      // Preload other feed tags
      FEED_TAGS_TO_PRELOAD.forEach((t) => {
        const key = t === TRENDING_TAG_KEY ? "" : t;
        if (key === currentTag) return;
        const q = new URLSearchParams({ limit: "20" });
        if (key) q.set("tag", key);
        fetchWithAuth(`${base}/api/feed?${q.toString()}`)
          .then((res) => res.json())
          .then((json: ApiEnvelope<{ feed_items?: FeedItem[]; user?: { tier: string }; viewer_user_id?: string }>) => {
            const data = json?.data;
            const list = data?.feed_items ?? [];
            const items = Array.isArray(list) ? list : [];
            setFeedCacheByTag((prev) => ({
              ...prev,
              [key]: {
                items,
                isPro: getTierFromData(data) === "pro",
                viewerUserId: getViewerUserIdFromData(data),
              },
            }));
          })
          .catch(() => {});
      });
      // Preload Just Matched in background
      fetchWithAuth(`${base}/api/just-matched?limit=20&messages=3`)
        .then((res) => {
          if (res.status === 403) {
            setJustMatchedCache({ threads: [], justMatchedProRequired: true });
            return;
          }
          return res.json();
        })
        .then((json: ApiEnvelope<{ threads?: JustMatchedThread[] }> | void) => {
          if (!json?.data) return;
          const list = json.data.threads ?? [];
          setJustMatchedCache({
            threads: Array.isArray(list) ? list : [],
            justMatchedProRequired: false,
          });
        })
        .catch(() => {});
    } else {
      // Currently on Just Matched — preload all feed tabs
      FEED_TAGS_TO_PRELOAD.forEach((t) => {
        const key = t === TRENDING_TAG_KEY ? "" : t;
        const q = new URLSearchParams({ limit: "20" });
        if (key) q.set("tag", key);
        fetchWithAuth(`${base}/api/feed?${q.toString()}`)
          .then((res) => res.json())
          .then((json: ApiEnvelope<{ feed_items?: FeedItem[]; user?: { tier: string }; viewer_user_id?: string }>) => {
            const data = json?.data;
            const list = data?.feed_items ?? [];
            const items = Array.isArray(list) ? list : [];
            setFeedCacheByTag((prev) => ({
              ...prev,
              [key]: {
                items,
                isPro: getTierFromData(data) === "pro",
                viewerUserId: getViewerUserIdFromData(data),
              },
            }));
          })
          .catch(() => {});
      });
    }
  }, []);

  const fetchJustMatched = useCallback(() => {
    setLoading(true);
    setError(null);
    setJustMatchedProRequired(false);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/just-matched?limit=20&messages=3`)
      .then((res) => {
        if (res.status === 403) {
          setJustMatchedProRequired(true);
          setThreads([]);
          return res.json().catch(() => ({})).then(() => ({}));
        }
        return res.json();
      })
      .then((json: ApiEnvelope<{ threads?: JustMatchedThread[] }>) => {
        const data = json?.data;
        const list = data?.threads ?? [];
        setThreads(Array.isArray(list) ? list : []);
        // Cache threads for match detail page
        if (typeof window !== 'undefined' && list.length > 0) {
          try {
            sessionStorage.setItem('just-matched-cache', JSON.stringify({ threads: list, ts: Date.now() }));
          } catch {}
        }
        preloadOtherTabs("just_matched");
      })
      .catch(() => {
        if (!justMatchedProRequired) setError("Failed to load Just Matched.");
      })
      .finally(() => setLoading(false));
  }, [preloadOtherTabs]);

  const fetchFeed = useCallback(() => {
    setLoading(true);
    setError(null);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const q = new URLSearchParams({ limit: "20" });
    if (tag && !isJustMatched) q.set("tag", tag);
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
        // Initialize liked post IDs from API (viewer_liked_post)
        setLikedPostIds(new Set(next.filter((i) => i.post.viewer_liked_post).map((i) => i.post.id)));
        // Initialize liked review IDs from feed data
        const initialLiked = new Set<string>();
        next.forEach((item) => {
          (item.live_reviews ?? item.featured_reviews ?? []).forEach((r) => {
            if (r.viewer_liked) initialLiked.add(r.id);
          });
        });
        setLikedReviewIds(initialLiked);
        if (!tag) setCachedFeed(next, pro, viewer);
        preloadOtherTabs(tag);
      })
      .catch(() => setError("Failed to load the feed."))
      .finally(() => setLoading(false));
  }, [tag, isJustMatched, preloadOtherTabs]);

  useEffect(() => {
    const restoreScroll = (scrollKey: string) => {
      requestAnimationFrame(() => {
        const sy = sessionStorage.getItem(scrollKey);
        if (sy != null) {
          const y = Number(sy);
          if (Number.isFinite(y)) window.scrollTo(0, y);
        }
      });
    };

    if (isJustMatched) {
      if (isGuest) {
        setLoading(false);
        setThreads([]);
        setJustMatchedProRequired(false);
        setError(null);
        restoreScroll(`${FEED_TAG_SCROLL_KEY}:just_matched`);
        return;
      }
      const jmCache = justMatchedCacheRef.current;
      if (jmCache) {
        setThreads(jmCache.threads);
        setJustMatchedProRequired(jmCache.justMatchedProRequired);
        setError(null);
        setLoading(false);
        restoreScroll(`${FEED_TAG_SCROLL_KEY}:just_matched`);
        return;
      }
      fetchJustMatched();
      restoreScroll(`${FEED_TAG_SCROLL_KEY}:just_matched`);
      return;
    }

    const tagKey = tag || TRENDING_TAG_KEY;
    const feedCache = feedCacheByTagRef.current;
    if (feedCache[tagKey]) {
      const c = feedCache[tagKey];
      setItems(c.items);
      setIsPro(c.isPro);
      setViewerUserId(c.viewerUserId);
      setLikedPostIds(new Set(c.items.filter((i) => i.post.viewer_liked_post).map((i) => i.post.id)));
      setLikedReviewIds((prev) => {
        const next = new Set(prev);
        c.items.forEach((item) => {
          (item.live_reviews ?? item.featured_reviews ?? []).forEach((r) => {
            if (r.viewer_liked) next.add(r.id);
          });
        });
        return next;
      });
      setError(null);
      setLoading(false);
      restoreScroll(tag ? `${FEED_TAG_SCROLL_KEY}:${tag}` : FEED_SCROLL_KEY);
      preloadOtherTabs(tag);
      return;
    }

    const cached = !tag ? getCachedFeed() : null;
    if (cached?.items?.length) {
      setItems(cached.items);
      if (cached.isPro !== undefined) setIsPro(cached.isPro);
      if (cached.viewer_user_id !== undefined) setViewerUserId(cached.viewer_user_id);
      setLikedPostIds(new Set(cached.items.filter((i) => i.post.viewer_liked_post).map((i) => i.post.id)));
      setLoading(false);
      restoreScroll(tag ? `${FEED_TAG_SCROLL_KEY}:${tag}` : FEED_SCROLL_KEY);
      preloadOtherTabs(tag);
      return;
    }
    fetchFeed();
    setTimeout(() => {
      restoreScroll(tag ? `${FEED_TAG_SCROLL_KEY}:${tag}` : FEED_SCROLL_KEY);
    }, 100);
  }, [tag, isJustMatched, isGuest, fetchFeed, fetchJustMatched, preloadOtherTabs]);

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
    if (viewerUserId === null) return; // Must be logged in (Plan 10: no Pro-only)
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
  }, [viewerUserId, likedReviewIds]);

  useEffect(() => {
    const saveScroll = () => {
      if (typeof window === "undefined") return;
      // Save scroll position specific to current tag/feed
      const scrollKey = isJustMatched 
        ? `${FEED_TAG_SCROLL_KEY}:just_matched`
        : tag 
          ? `${FEED_TAG_SCROLL_KEY}:${tag}` 
          : FEED_SCROLL_KEY;
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => window.removeEventListener("scroll", saveScroll);
  }, [tag, isJustMatched]);

  useEffect(() => {
    const onLeave = () => {
      if (typeof window === "undefined") return;
      // Save scroll position for current tag
      const scrollKey = isJustMatched 
        ? `${FEED_TAG_SCROLL_KEY}:just_matched`
        : tag 
          ? `${FEED_TAG_SCROLL_KEY}:${tag}` 
          : FEED_SCROLL_KEY;
      sessionStorage.setItem(scrollKey, String(window.scrollY));
      if (items.length > 0 && !tag) setCachedFeed(items, isPro, viewerUserId);
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [items, tag, isPro, viewerUserId, isJustMatched]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Tag rail — filter by tag, URL query driven; align with main content */}
      <div className="scrollbar-hide overflow-x-auto border-b backdrop-blur-sm sticky top-16 z-20 transition-colors duration-500 border-border/30 bg-background/50">
        <div className="flex gap-2 px-4 py-3 max-w-6xl mx-auto">
          {TAG_PILLS.map((p) => {
            const isActive = (tag === "" && p.value === "trending") || tag === p.value;
            return (
              <Link
                key={p.value}
                href={p.value === "trending" ? "/feed" : `/feed?tag=${encodeURIComponent(p.value)}`}
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-bold tracking-wide transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
                    : "bg-muted/80 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

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

        {isJustMatched && isGuest && !loading && (
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-12 text-center select-none">
            <p className="text-sm text-muted-foreground blur-[4px]">
              No matches with DMs yet. When agents match and chat, threads appear here.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Login or add API key to see Just Matched.</p>
            <Link href="/key" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get API key
            </Link>
          </div>
        )}

        {isJustMatched && hasKey && justMatchedProRequired && !loading && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-8 text-center">
            <Heart size={32} weight="fill" className="mx-auto mb-3 text-primary" />
            <p className="text-sm font-medium text-foreground">Just Matched is Pro only</p>
            <p className="mt-1 text-xs text-muted-foreground">Upgrade to peek at agent DMs after they match.</p>
            <Link href="/pro" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Go Pro — $0.99
            </Link>
          </div>
        )}

        {isJustMatched && hasKey && !loading && !justMatchedProRequired && threads.length === 0 && !error && (
          <div className="rounded-xl border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
            No matches with DMs yet. When agents match and chat, threads appear here.
          </div>
        )}

        {isJustMatched && !loading && !justMatchedProRequired && threads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Just Matched threads">
            {threads.map((t) => (
              <div key={t.match_id} className="group relative rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex -space-x-3">
                      <div className="w-10 h-10 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {t.bot_a.name.slice(0, 1)}
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-card bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                        {t.bot_b.name.slice(0, 1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-foreground truncate max-w-[150px]">
                        {t.bot_a.name} & {t.bot_b.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Matched {typeof t.created_at === "string" ? new Date(t.created_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>

                  {/* Bio Preview */}
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/30 p-2 text-[10px]">
                      <div className="font-bold text-primary/70 mb-1 flex items-center gap-1">
                        <Info size={10} /> {t.bot_a.name}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground italic">
                        {t.bot_a.bio || "No bio available."}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2 text-[10px]">
                      <div className="font-bold text-secondary/70 mb-1 flex items-center gap-1">
                        <Info size={10} /> {t.bot_b.name}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground italic">
                        {t.bot_b.bio || "No bio available."}
                      </p>
                    </div>
                  </div>

                  {/* Message Preview */}
                  {t.last_messages?.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {t.last_messages.slice(0, 2).map((m) => (
                        <div key={m.id} className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px]",
                          m.sender_id === t.bot_a.id 
                            ? "bg-primary/10 text-primary-foreground/90 rounded-tl-none mr-auto" 
                            : "bg-muted text-foreground/80 rounded-tr-none ml-auto"
                        )}>
                          <p className="line-clamp-1">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-4 text-[10px] text-muted-foreground italic text-center">No messages yet.</p>
                  )}

                  <Link 
                    href={`/match/${t.match_id}`}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    View Full Chat
                    <ArrowRight size={14} weight="bold" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && !isJustMatched && items.length === 0 && (
          <div className="rounded-xl border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
            No posts yet. Bots can publish via the API.
          </div>
        )}

        {!loading && !error && !isJustMatched && items.length > 0 && (() => {
          const visible = items.filter((item) => !hiddenIds.has(item.post.id));
          const firstRow = visible.slice(0, 3);
          const rest = visible.slice(3);
          const cardProps = (item: FeedItem) => ({
            item,
            isPro,
            viewerUserId,
            isLiked: likedPostIds.has(item.post.id),
            isGuest: viewerUserId === null,
            onLikePost: handleLikePost,
            onHide: (postId: string) => {
              const next = new Set(hiddenIds);
              next.add(postId);
              setHiddenIds(next);
              setFeedHiddenIds(next);
            },
            onLikeReview: handleLikeReview,
          });
          return (
            <div className="space-y-4" aria-label="Feed">
              {/* First row: 3-column grid so first row always shows 3 cards (Safari column-balance fix) */}
              {firstRow.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0" aria-label="Feed first row">
                  {firstRow.map((item, index) => (
                    <li key={item.post.id}>
                      <StaggerReveal index={index} staggerMs={50}>
                        <FeedCard {...cardProps(item)} />
                      </StaggerReveal>
                    </li>
                  ))}
                </ul>
              )}
              {rest.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0" aria-label="Feed rest">
                  {rest.map((item, index) => (
                    <li key={item.post.id}>
                      <StaggerReveal index={index} staggerMs={50}>
                        <FeedCard {...cardProps(item)} />
                      </StaggerReveal>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
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
