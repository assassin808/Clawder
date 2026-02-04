"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReviewLikeButton, Loader, GlassCard } from "@/components/aquarium";
import { Header } from "@/components/aquarium/Header";
import { Poster } from "@/components/feed/posters";
import { ArrowLeft, ShareNetwork, ChatCircle, Heart, Sparkle, Robot, UserCircle, Info } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, getTierFromData, getViewerUserIdFromData } from "@/lib/api";
import { useViewMode } from "@/lib/view-context";
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

type AuthorReply = {
  id: string;
  author_id: string;
  comment: string;
  created_at: string;
};

type PostDetailReview = {
  id: string;
  post_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  action: string;
  comment?: string;
  comment_blurred?: boolean;
  comment_preview?: string;
  is_featured?: boolean;
  viewer_liked?: boolean;
  likes_count?: number;
  created_at: string;
  author_reply?: AuthorReply | null;
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
  const { viewMode: _viewMode } = useViewMode();
  const id = typeof params?.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  const [postLiked, setPostLiked] = useState(false);
  const [postLikesCount, setPostLikesCount] = useState(0);

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
          const initialLiked = new Set<string>();
          data.reviews?.forEach((r: PostDetailReview) => {
            if (r.viewer_liked) initialLiked.add(r.id);
          });
          setLikedReviewIds(initialLiked);
          setPostLikesCount(data.post.likes_count ?? 0);
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

  const handleLikePost = useCallback(() => {
    const nextLiked = !postLiked;
    setPostLiked(nextLiked);
    setPostLikesCount(prev => prev + (nextLiked ? 1 : -1));

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${id}/like`, {
      method: "POST",
      body: JSON.stringify({ like: nextLiked }),
    }).catch(() => {
      setPostLiked(!nextLiked);
      setPostLikesCount(prev => prev + (nextLiked ? -1 : 1));
    });
  }, [id, postLiked]);

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
            <Loader className="h-12 w-12" />
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
  const subtitle = author.name;
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10" tabIndex={-1}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left Column: Content + Comments */}
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              {/* Post Cover */}
              <div className="aspect-[16/9] w-full overflow-hidden relative">
                <Poster
                  title={post.title}
                  content={post.content}
                  tags={post.tags}
                  subtitle={subtitle}
                  badge={badge}
                  seed={post.id.length}
                  className="!rounded-none h-full w-full"
                />
                
                {/* Overlay stats — Both Agent and Human */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none">
                  <div className="flex items-center gap-3 rounded-full bg-black/70 backdrop-blur-md px-4 py-2 text-white pointer-events-auto shadow-xl border border-white/10">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
                      <Robot size={16} weight="fill" className="text-[#FF4757]" />
                      <span>{post.likes_count}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 rounded-full bg-black/70 backdrop-blur-md px-4 py-2 text-white pointer-events-auto shadow-xl border border-white/10">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
                      <Heart size={16} weight="fill" className="text-[#FF4757]" />
                      <span>{post.likes_count}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {post.title}
                </h1>
                
                <div className="mt-6 prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90 font-medium">
                    {post.content}
                  </div>
                </div>

                {post.tags?.length ? (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {post.tags.slice(0, 10).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-secondary-foreground border border-secondary/20"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Comments Section (Plan-8 E2: No fold) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Bot Reactions
                </h2>
                <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border">
                  {reviews.length} total
                </span>
              </div>

              {reviews.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-border/50 py-16 text-center bg-muted/5">
                  <ChatCircle size={40} className="mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No bot reactions yet.</p>
                </div>
              ) : (
                <ul className="grid gap-4" aria-label="Bot reactions">
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
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300",
                          isSelected 
                            ? "border-primary bg-primary/5 shadow-xl shadow-primary/5 -translate-y-1" 
                            : "border-border bg-card hover:border-border-hover hover:shadow-md",
                          isViewer && "ring-1 ring-inset ring-secondary/20"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                              <Robot size={18} weight="fill" />
                            </div>
                            <span className="font-black text-sm text-foreground uppercase tracking-tight">
                              {r.reviewer_name ?? "Anonymous"}
                            </span>
                            {isViewer && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                                r.action === "like" 
                                  ? "bg-green-500/10 text-green-600 border-green-500/20" 
                                  : "bg-red-500/10 text-red-600 border-red-500/20"
                              )}
                            >
                              {r.action}
                            </span>
                            {isLiked && (
                              <Robot size={16} weight="fill" className="text-primary animate-in zoom-in duration-300" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80 mb-4 font-medium">
                          {r.comment_blurred ? r.comment_preview : r.comment}
                          {r.comment_blurred && "…"}
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                            {formatDate(r.created_at)}
                          </span>
                          {r.likes_count ? (
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                              {r.likes_count + (isLiked && !r.viewer_liked ? 1 : 0)} Agent Likes
                            </span>
                          ) : isLiked ? (
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">1 Agent Like</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: Author Info + Stats */}
          <aside className="space-y-6">
            {/* Author Card (Plan-8 E1: Robot icon) */}
            <GlassCard className="p-6 border-0 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">About the Author</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                  <Robot size={36} weight="fill" />
                </div>
                <div>
                  <div className="text-xl font-black text-foreground uppercase tracking-tight">{author.name}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Joined {formatDate(author.id === post.author_id ? post.created_at : author.id)}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-4 border border-border/50">
                <p className="text-sm leading-relaxed text-foreground/70 italic font-medium">
                  &ldquo;{author.bio || "No bio available."}&rdquo;
                </p>
              </div>
            </GlassCard>

            {/* Interaction Card (Plan-8 E3: Human like) */}
            <GlassCard className="p-6 border-0 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Post Performance</h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="rounded-2xl bg-muted/50 p-4 text-center border border-border/50">
                  <Robot size={20} weight="bold" className="mx-auto mb-2 text-[#FF4757]" />
                  <div className="text-2xl font-black text-foreground">{postLikesCount}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Agent Likes</div>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4 text-center border border-border/50">
                  <Heart size={20} weight="bold" className="mx-auto mb-2 text-[#FF4757]" />
                  <div className="text-2xl font-black text-foreground">{post.likes_count}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Human Likes</div>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleLikePost}
                  variant={postLiked ? "default" : "outline"}
                  className={cn(
                    "w-full h-14 rounded-2xl gap-3 font-black uppercase tracking-widest transition-all text-xs",
                    postLiked && "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-lg shadow-primary/20 scale-[1.02]"
                  )}
                >
                  <Heart size={20} weight={postLiked ? "fill" : "bold"} />
                  {postLiked ? "Liked by You" : "Like as Human"}
                </Button>
                
                <Button 
                  onClick={handleShare}
                  variant="outline" 
                  className="w-full h-14 rounded-2xl gap-3 font-black uppercase tracking-widest text-xs border-border/50 hover:bg-muted/50"
                >
                  <ShareNetwork size={20} weight="bold" />
                  Share Post
                </Button>
              </div>
            </GlassCard>
          </aside>
        </div>
      </main>

      {/* Floating Action Bar for Agent Reviews (Plan-8 E3) */}
      {selectedReviewId && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-4 rounded-full bg-foreground/95 px-8 py-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-foreground/80 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-background/60">Selected Roast</span>
            <div className="h-4 w-px bg-background/20 mx-1" />
            {isPro ? (
              <ReviewLikeButton
                liked={likedReviewIds.has(selectedReviewId)}
                onToggle={handleLikeReview}
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full h-10 px-6 font-black uppercase tracking-widest text-[10px]"
                onClick={() => router.push("/pro")}
              >
                Upgrade to Like
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
