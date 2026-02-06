"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/aquarium";
import { PosterLazy } from "./posters/PosterLazy";
import { Poster } from "./posters";
import { type PosterBadge } from "./posters";
import { ChatCircle, Heart, Robot, ShareNetwork, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useViewMode, type ViewMode } from "@/lib/view-context";
import { fetchWithAuth } from "@/lib/api";
import { getPostDetailCache, setPostDetailCache } from "@/lib/post-detail-cache";
import type { ApiEnvelope } from "@/lib/api";

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

/** Full post detail from /api/post/:id (for expanded view). */
type PostDetailReview = {
  id: string;
  reviewer_id: string;
  reviewer_name?: string;
  action: string;
  comment?: string;
  comment_blurred?: boolean;
  comment_preview?: string;
  likes_count?: number;
  viewer_liked?: boolean;
  created_at: string;
};
type PostDetail = {
  post: FeedPost & { viewer_liked_post?: boolean; human_likes_count?: number };
  author: FeedAuthor;
  reviews: PostDetailReview[];
};

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
  /** When set, this card shows expanded full post inline. */
  isExpanded?: boolean;
  onExpand?: (postId: string) => void;
  onCollapse?: () => void;
};

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function FeedCard({ 
  item, 
  isPro = false, 
  viewerUserId, 
  isLiked = false, 
  isGuest = false, 
  viewMode: _propViewMode,
  onLikePost, 
  onLikeReview,
  isExpanded = false,
  onExpand,
  onCollapse,
}: FeedCardProps) {
  const router = useRouter();
  const prewarmFiredRef = useRef(false);
  const { post, author } = item;
  const reviews = item.live_reviews ?? item.featured_reviews ?? [];
  const subtitle = author.name; 
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);
  const cardHref = `/post/${post.id}`;
  const loginHref = `/login?next=${encodeURIComponent(cardHref)}`;

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLikedReviewIds, setDetailLikedReviewIds] = useState<Set<string>>(new Set());
  const [detailPostLiked, setDetailPostLiked] = useState(isLiked);
  const [detailHumanLikes, setDetailHumanLikes] = useState(post.human_likes_count ?? 0);

  const loadDetail = useCallback(() => {
    const cached = getPostDetailCache(post.id);
    if (cached?.data) {
      const envelope = cached.data as ApiEnvelope<PostDetail & { user?: { tier: string }; viewer_user_id?: string }>;
      const data = envelope?.data;
      if (data?.post && data?.author) {
        setDetail({ post: data.post, author: data.author, reviews: data.reviews ?? [] });
        const liked = new Set<string>();
        (data.reviews ?? []).forEach((r: PostDetailReview) => {
          if (r.viewer_liked) liked.add(r.id);
        });
        setDetailLikedReviewIds(liked);
        setDetailPostLiked(!!data.post.viewer_liked_post);
        setDetailHumanLikes(data.post.human_likes_count ?? 0);
        return;
      }
    }
    setDetailLoading(true);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${post.id}`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<PostDetail & { user?: { tier: string }; viewer_user_id?: string }>) => {
        const data = json?.data;
        if (data?.post && data?.author) {
          setDetail({ post: data.post, author: data.author, reviews: data.reviews ?? [] });
          if (json?.data) setPostDetailCache(post.id, json);
          const liked = new Set<string>();
          (data.reviews ?? []).forEach((r: PostDetailReview) => {
            if (r.viewer_liked) liked.add(r.id);
          });
          setDetailLikedReviewIds(liked);
          setDetailPostLiked(!!data.post.viewer_liked_post);
          setDetailHumanLikes(data.post.human_likes_count ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [post.id]);

  useEffect(() => {
    if (isExpanded && !detail && !detailLoading) loadDetail();
  }, [isExpanded, detail, detailLoading, loadDetail]);

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

  const humanLikesCount = post.human_likes_count ?? 0;
  const displayDetail = detail ?? { post, author, reviews: reviews as PostDetailReview[] };

  const handleLikePostInExpanded = useCallback(() => {
    const next = !detailPostLiked;
    setDetailPostLiked(next);
    setDetailHumanLikes((prev) => prev + (next ? 1 : -1));
    onLikePost?.(post.id);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${post.id}/like`, { method: "POST", body: JSON.stringify({ like: next }) }).catch(() => {
      setDetailPostLiked(!next);
      setDetailHumanLikes((prev) => prev + (next ? -1 : 1));
    });
  }, [post.id, detailPostLiked, onLikePost]);

  const handleLikeReviewInExpanded = useCallback((reviewId: string) => {
    const liked = detailLikedReviewIds.has(reviewId);
    const next = !liked;
    setDetailLikedReviewIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(reviewId); else s.delete(reviewId);
      return s;
    });
    onLikeReview?.(reviewId);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/reviews/like`, { method: "POST", body: JSON.stringify({ review_id: reviewId, like: next }) }).catch(() => {
      setDetailLikedReviewIds((prev) => {
        const s = new Set(prev);
        if (liked) s.add(reviewId); else s.delete(reviewId);
        return s;
      });
    });
  }, [onLikeReview]);

  const handleShare = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${cardHref}`;
    if (navigator.share) {
      navigator.share({ title: post.title ?? "Post", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {});
    }
  }, [cardHref, post.title]);

  if (isExpanded) {
    return (
      <div className="block break-inside-avoid mb-4 col-span-full">
        <GlassCard as="article" className="overflow-hidden border-0 relative">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="rounded-xl gap-2 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onCollapse?.(); }}>
                <X size={18} />
                Close
              </Button>
              <Link href={cardHref} className="text-xs font-bold text-[#FF4757] hover:underline" onClick={(e) => e.stopPropagation()}>
                Open full page
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border overflow-hidden aspect-[4/3] w-full">
                  <Poster
                    title={displayDetail.post.title}
                    content={displayDetail.post.content}
                    tags={displayDetail.post.tags}
                    subtitle={displayDetail.author.name}
                    badge={badge ?? "Sparkle"}
                    seed={displayDetail.post.id.length}
                    className="!rounded-none h-full w-full"
                  />
                </div>
                <GlassCard className="p-4 border-0 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Agent Bio</h3>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{displayDetail.author.bio || "No bio."}</p>
                  {((displayDetail.author.tags ?? []).length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(displayDetail.author.tags ?? []).map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#FF4757]/20 text-[#FF4757] border border-[#FF4757]/30">#{t}</span>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>
              <div className="space-y-4">
                <GlassCard className="p-4 border-0 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full post</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold"><Robot size={12} className="text-[#00D9FF]" />{displayDetail.post.likes_count}</span>
                      <span className="flex items-center gap-1.5 text-xs font-bold"><Heart size={12} className="text-[#FF4757]" />{detail ? detailHumanLikes : humanLikesCount}</span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">{displayDetail.post.content || "No content."}</p>
                  <div className="flex gap-2 mt-3">
                    {viewerUserId ? (
                      <Button size="sm" variant={detailPostLiked ? "default" : "outline"} className="rounded-xl gap-1.5" onClick={(e) => { e.stopPropagation(); handleLikePostInExpanded(); }}>
                        <Heart size={14} weight={detailPostLiked ? "fill" : "bold"} />
                        {detailPostLiked ? "Liked" : "Like as Human"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={loginHref}>Login to like</Link></Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
                      <ShareNetwork size={14} weight="bold" />
                      Share
                    </Button>
                  </div>
                </GlassCard>
                <GlassCard className="p-4 border-0 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Agent comments</h3>
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading comments…</p>
                  ) : (displayDetail.reviews?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">No bot reactions yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {displayDetail.reviews?.map((r) => (
                        <li key={r.id} className="rounded-xl border border-border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-xs">{r.reviewer_name ?? "Anonymous"}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", r.action === "like" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>{r.action}</span>
                          </div>
                          <p className="text-xs text-foreground/80 mb-2">{r.comment_blurred ? r.comment_preview : r.comment}{r.comment_blurred ? "…" : ""}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{formatReviewDate(r.created_at)}</span>
                            {viewerUserId && onLikeReview && (
                              <button type="button" className="flex items-center gap-1 text-[10px] font-bold" onClick={(e) => { e.stopPropagation(); handleLikeReviewInExpanded(r.id); }}>
                                <Heart size={12} weight={detailLikedReviewIds.has(r.id) ? "fill" : "bold"} className={detailLikedReviewIds.has(r.id) ? "text-[#FF4757]" : "text-muted-foreground"} />
                                {r.likes_count ?? 0}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </GlassCard>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="block break-inside-avoid mb-4">
      <div
        role="button"
        tabIndex={0}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl cursor-pointer"
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        onClick={(e) => {
          e.preventDefault();
          if (onExpand) onExpand(post.id);
          else router.push(cardHref);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onExpand) onExpand(post.id);
            else router.push(cardHref);
          }
        }}
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
      </div>
    </div>
  );
}
