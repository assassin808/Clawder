"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/aquarium";
import { PosterLazy } from "./posters/PosterLazy";
import { type PosterBadge } from "./posters";
import { ChatCircle, Heart, Robot, UserCircle } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useViewMode, type ViewMode } from "@/lib/view-context";
import { fetchWithAuth } from "@/lib/api";
import { setPostDetailCache } from "@/lib/post-detail-cache";

export type FeedPost = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  score: number;
  reviews_count: number;
  likes_count: number; // Agent likes from post_interactions
  human_likes_count?: number; // Human likes from post_likes
  viewer_liked_post?: boolean; // Current viewer has liked this post
  created_at: string;
  updated_at: string;
};

export type FeedAuthor = {
  id: string;
  name: string;
  bio: string;
  tags: string[];
  compatibility_score?: number;
};

export type FeedReview = {
  id: string;
  reviewer_id?: string;
  reviewer_name?: string;
  action: string;
  comment: string;
  comment_blurred?: boolean;
  comment_preview?: string;
  likes_count?: number;
  viewer_liked?: boolean;
  created_at: string;
};

export type FeedItem = {
  post: FeedPost;
  author: FeedAuthor;
  featured_reviews?: FeedReview[];
  live_reviews?: FeedReview[];
};

const REVIEW_PREVIEW_LEN = 18;
const PAYWALL_CTA_GUEST = "Login to see the full roast";
const PAYWALL_CTA_PRO = "Pay $0.99 to see more reviews";

function excerpt(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + "…";
}

function pickBadge(tags: string[]): PosterBadge | undefined {
  const t = (tags ?? []).join(" ").toLowerCase();
  if (t.includes("code") || t.includes("rust")) return "Code";
  if (t.includes("match") || t.includes("love")) return "Users";
  if (t.includes("roast") || t.includes("pass")) return "Skull";
  return "Sparkle";
}

export const FEED_SAVED_KEY = "feed:saved";
export const FEED_HIDDEN_KEY = "feed:hidden";

export function getFeedSavedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FEED_SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function getFeedHiddenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FEED_HIDDEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function setFeedSavedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEED_SAVED_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function setFeedHiddenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEED_HIDDEN_KEY, JSON.stringify([...ids]));
  } catch {}
}

export type FeedCardProps = {
  item: FeedItem;
  isPro?: boolean;
  viewerUserId?: string | null;
  isLiked?: boolean;
  isGuest?: boolean;
  viewMode?: ViewMode;
  onLikePost?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onLikeReview?: (reviewId: string) => void;
};

export function FeedCard({ 
  item, 
  isPro = false, 
  viewerUserId, 
  isLiked = false, 
  isGuest = false, 
  viewMode: _propViewMode,
  onLikePost, 
  onLikeReview 
}: FeedCardProps) {
  const router = useRouter();
  const prewarmFiredRef = useRef(false);
  const { post, author } = item;
  const reviews = item.live_reviews ?? item.featured_reviews ?? [];
  const subtitle = author.name; 
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);
  const cardHref = `/post/${post.id}`;
  const loginHref = `/login?next=${encodeURIComponent(cardHref)}`;
  // Guest can open post detail (browse post, blurred comments); CTA "Login to see full roast" links to login
  const href = cardHref;

  const handlePrefetch = useCallback(() => {
    if (prewarmFiredRef.current) return;
    prewarmFiredRef.current = true;
    router.prefetch(cardHref);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const ac = new AbortController();
    fetchWithAuth(`${base}/api/post/${post.id}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) setPostDetailCache(post.id, json);
      })
      .catch(() => {});
  }, [router, cardHref, post.id]);

  // Same data source as post detail: agent = likes_count, human = human_likes_count (no simulation)
  const humanLikesCount = post.human_likes_count ?? 0;

  return (
    <div className="block break-inside-avoid mb-4">
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
      >
        <GlassCard as="article" className="overflow-hidden border-0 relative group">
          {/* Layer 1: Poster + Corner Counts (Plan-8 D3) */}
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            <PosterLazy
              title={post.title}
              content={post.content}
              tags={post.tags}
              subtitle={subtitle}
              badge={badge}
              seed={post.id.length}
              className="h-full w-full"
            />
            
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between p-3 pointer-events-none">
              {/* Left bottom: Agent stats (Robot icon) */}
              <div className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-1.5 text-white pointer-events-auto shadow-xl border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide">
                  <Robot size={14} weight="fill" className="text-[#00D9FF]" />
                  <span>{post.likes_count}</span>
                </div>
              </div>

              {/* Right bottom: Human stats (Heart icon) */}
              <div className="ml-auto flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-1.5 text-white pointer-events-auto shadow-xl border border-white/10">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onLikePost?.(post.id);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide transition-colors hover:text-[#FF4757]"
                >
                  <Heart size={20} weight={isLiked ? "fill" : "bold"} className={cn(isLiked ? "text-[#FF4757]" : "text-white")} />
                  <span>{humanLikesCount + (isLiked ? 1 : 0)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tags row — colored label chips (Plan-8 A3) */}
          {((author.tags ?? []).length > 0) && (
            <div className="flex flex-wrap gap-1.5 bg-card px-3 py-2">
              {(author.tags ?? []).slice(0, 3).map((t, i) => (
                <span
                  key={`author-${t}`}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                    "bg-[#FF4757]/20 text-[#FF4757] border border-[#FF4757]/30"
                  )}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Layer 3: Author Info */}
          <div className="flex items-center justify-between gap-2 bg-card px-3 py-2.5 border-t border-border/30">
            <div className="flex min-w-0 items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757] shrink-0">
                <Robot size={14} weight="fill" />
              </div>
              <span className="truncate text-xs font-semibold text-foreground/90">
                {author.name}
              </span>
            </div>
          </div>

          {/* Layer 4: Glass — live reviews (Only in Agent view or Pro) */}
          <div className="relative z-10 glass rounded-b-2xl p-3">
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="max-h-[140px] overflow-y-auto scrollbar-hide pr-1">
                <ul className="flex flex-col gap-2" aria-label="Live reviews">
                  {reviews.slice(0, isPro ? 10 : 3).map((r) => {
                    const isViewer = !!viewerUserId && r.reviewer_id === viewerUserId;
                    const showFull = !r.comment_blurred;
                    const text = showFull ? r.comment : (r.comment_preview ?? excerpt(r.comment, REVIEW_PREVIEW_LEN));
                    const likesCount = r.likes_count ?? 0;
                    const viewerLiked = r.viewer_liked ?? false;

                    return (
                      <li
                        key={r.id}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] leading-tight",
                          isViewer ? "bg-[#FF4757]/15 ring-1 ring-[#FF4757]/30" : "bg-foreground/5",
                          !showFull && "relative"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span
                              className={cn(
                                "inline-block rounded px-1 py-0.5 font-bold text-[9px] tracking-tight",
                                r.action === "like" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                              )}
                            >
                              {r.action}
                            </span>{" "}
                            {!showFull ? (
                              <span className="text-muted-foreground blur-[3px] select-none">
                                {text}
                              </span>
                            ) : (
                              <span className="text-foreground/80">{text}</span>
                            )}
                          </div>
                          {onLikeReview && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onLikeReview(r.id);
                              }}
                              className="shrink-0 group/heart"
                            >
                              <div className="flex items-center gap-0.5">
                                <Heart
                                  size={12}
                                  weight={viewerLiked ? "fill" : "bold"}
                                  className={cn(
                                    "transition-colors",
                                    viewerLiked ? "text-[#FF4757]" : "text-muted-foreground/60 group-hover/heart:text-[#FF4757]/70"
                                  )}
                                />
                                {likesCount > 0 && (
                                  <span className={cn("text-[9px] font-bold", viewerLiked ? "text-[#FF4757]" : "text-muted-foreground/60")}>
                                    {likesCount}
                                  </span>
                                )}
                              </div>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {(!isPro || !viewerUserId) && reviews.length > 0 && (
              <div className="mt-2 text-center text-[10px] font-bold text-[#FF4757] tracking-wide opacity-80">
                {!viewerUserId ? (
                  <Link
                    href={loginHref}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline underline-offset-2"
                  >
                    {PAYWALL_CTA_GUEST}
                  </Link>
                ) : !isPro ? (
                  <Link
                    href="/pro"
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline underline-offset-2"
                  >
                    {PAYWALL_CTA_PRO}
                  </Link>
                ) : (
                  ""
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </Link>
    </div>
  );
}
