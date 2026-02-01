"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReviewLikeButton } from "@/components/aquarium";
import { Poster } from "@/components/feed/posters";
import { ArrowLeft, ShareNetwork, ChatCircle, Heart } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, getTierFromData, getViewerUserIdFromData } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";
import { cn } from "@/lib/utils";

type PostDetailPost = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  score: number;
  reviews_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
};

type PostDetailAuthor = {
  id: string;
  name: string;
  bio: string;
  tags: string[];
};

type PostDetailReview = {
  id: string;
  post_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  action: string;
  comment: string;
  is_featured?: boolean;
  viewer_liked?: boolean;
  likes_count?: number;
  created_at: string;
};

type PostDetail = {
  post: PostDetailPost;
  author: PostDetailAuthor;
  reviews: PostDetailReview[];
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function pickBadge(tags: string[]): "Code" | "Sparkle" | "Users" | "Skull" {
  const t = (tags ?? []).join(" ").toLowerCase();
  if (t.includes("code") || t.includes("rust")) return "Code";
  if (t.includes("match") || t.includes("love")) return "Users";
  if (t.includes("roast") || t.includes("pass")) return "Skull";
  return "Sparkle";
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  
  const reviewsEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!id) {
      setLoading(false);
      setError("Missing post id.");
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${id}`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<PostDetail & { user?: { tier: string }; viewer_user_id?: string }>) => {
        const data = json?.data;
        if (data && "post" in data && "author" in data) {
          setDetail({
            post: data.post,
            author: data.author,
            reviews: data.reviews ?? [],
          });
          setIsPro(getTierFromData(data) === "pro");
          setViewerUserId(getViewerUserIdFromData(data));
          
          // Pre-populate liked reviews from server data
          const initialLiked = new Set<string>();
          data.reviews?.forEach(r => {
            if (r.viewer_liked) initialLiked.add(r.id);
          });
          setLikedReviewIds(initialLiked);
        } else {
          setError((data as { error?: string })?.error ?? "Post not found.");
        }
      })
      .catch(() => setError("Failed to load post."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    router.back();
  }, [router]);

  const handleShare = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: detail?.post?.title ?? "Post",
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {});
    }
  }, [detail?.post?.title]);

  const handleLikeReview = useCallback(() => {
    if (!isPro || !selectedReviewId) return;
    const liked = likedReviewIds.has(selectedReviewId);
    const nextLiked = !liked;

    setLikedReviewIds((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(selectedReviewId);
      else next.delete(selectedReviewId);
      return next;
    });

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/reviews/like`, {
      method: "POST",
      body: JSON.stringify({ review_id: selectedReviewId, like: nextLiked }),
    })
      .then((res) => res.json())
      .then((json: ApiEnvelope<{ review_id: string; like: boolean }>) => {
        if (json.data) {
          // Sync with server state if needed
        }
      })
      .catch(() => {
        // Rollback on error
        setLikedReviewIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(selectedReviewId);
          else next.delete(selectedReviewId);
          return next;
        });
      });
  }, [isPro, selectedReviewId, likedReviewIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <span className="h-6 w-6 animate-pulse rounded-full bg-muted" />
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleBack}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="rounded-2xl border-0 bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="text-destructive" role="alert">
              {error ?? "Post not found."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { post, author, reviews } = detail;
  const tag = author.tags?.[0];
  const subtitle = [author.name, tag].filter(Boolean).join(" · ");
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div id="main" className="mx-auto max-w-2xl" tabIndex={-1}>
        <button
          onClick={handleBack}
          className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border/50 bg-background/95 px-4 py-3 text-sm font-medium text-muted-foreground backdrop-blur hover:text-foreground"
        >
          <ArrowLeft size={18} weight="bold" />
          Back
        </button>

        <div className="px-4 py-6 sm:px-0">
          {/* Post Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                <Poster
                  title={post.title}
                  subtitle=""
                  badge={badge}
                  seed={post.id.length}
                  className="h-full w-full"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{author.name}</div>
                <div className="text-xs text-muted-foreground">{formatDate(post.created_at)}</div>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
              {post.content}
            </div>
          </div>

          {post.tags?.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.slice(0, 10).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : null}

          {/* Stats */}
          <div className="mt-8 flex items-center gap-6 border-y border-border/50 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Heart size={18} className="text-primary" weight="fill" />
              <span className="font-medium text-foreground">{post.likes_count}</span>
              <span>likes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ChatCircle size={18} />
              <span className="font-medium text-foreground">{post.reviews_count}</span>
              <span>reviews</span>
            </div>
          </div>

          {/* Author Bio Section */}
          <div className="mt-8 rounded-2xl bg-muted/30 p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About the Author</h3>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex-1 text-sm leading-relaxed text-foreground/80">
                {author.bio || "No bio available."}
              </div>
            </div>
          </div>
        </div>

        {/* Live reviews list */}
        <div className="mt-8 px-4 sm:px-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Reviews</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {reviews.length} total
            </span>
          </div>
          
          {reviews.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-12 text-center">
              <ChatCircle size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first to interact!</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
              <ul className="flex flex-col gap-4" aria-label="Reviews">
                {reviews.map((r) => {
                  const isViewer = !!viewerUserId && r.reviewer_id === viewerUserId;
                  const isSelected = selectedReviewId === r.id;
                  const isLiked = likedReviewIds.has(r.id);
                  
                  return (
                    <li
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedReviewId(isSelected ? null : r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedReviewId(isSelected ? null : r.id);
                        }
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border transition-all duration-200",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5" 
                          : "border-border bg-card hover:border-border-hover hover:shadow-sm",
                        isViewer && "ring-1 ring-inset ring-secondary/20"
                      )}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {r.reviewer_name ?? "Anonymous"}
                            </span>
                            {isViewer && (
                              <span className="text-[10px] font-bold uppercase tracking-tighter text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                r.action === "like" 
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              )}
                            >
                              {r.action}
                            </span>
                            {isLiked && (
                              <Heart size={14} weight="fill" className="text-primary animate-in zoom-in duration-300" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80 mb-3">
                          {r.comment}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {formatDate(r.created_at)}
                          </span>
                          {r.likes_count ? (
                            <span className="text-[10px] font-bold text-primary/80">
                              {r.likes_count + (isLiked && !r.viewer_liked ? 1 : 0)} likes
                            </span>
                          ) : isLiked ? (
                            <span className="text-[10px] font-bold text-primary/80">1 like</span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div ref={reviewsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Floating bar: like selected review (pro-only), share */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 px-4">
          {selectedReviewId && isPro ? (
            <ReviewLikeButton
              liked={likedReviewIds.has(selectedReviewId)}
              onToggle={handleLikeReview}
            />
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              disabled={!selectedReviewId}
              onClick={() => {
                if (selectedReviewId && !isPro) {
                  router.push("/pro");
                }
              }}
              title={!isPro ? "Upgrade to Pro to like reviews" : "Select a review"}
            >
              {!selectedReviewId
                ? "Select a review"
                : !isPro
                  ? "Upgrade to like"
                  : "Like review"}
            </Button>
          )}
          <Button variant="outline" size="lg" className="gap-2" onClick={handleShare}>
            <ShareNetwork size={20} weight="regular" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}

      {/* Floating bar: like selected review (pro-only), share */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 px-4">
          {selectedReviewId && isPro ? (
            <ReviewLikeButton
              liked={likedReviewIds.has(selectedReviewId)}
              onToggle={handleLikeReview}
            />
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              disabled={!selectedReviewId}
              title={!isPro ? "Upgrade to Pro to like reviews" : "Select a review"}
            >
              {!selectedReviewId
                ? "Select a review"
                : !isPro
                  ? "Upgrade to like"
                  : "Like review"}
            </Button>
          )}
          <Button variant="outline" size="lg" className="gap-2" onClick={handleShare}>
            <ShareNetwork size={20} weight="regular" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
