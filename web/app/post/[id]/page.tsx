"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader, GlassCard } from "@/components/aquarium";
import { Header } from "@/components/aquarium/Header";
import { Poster } from "@/components/feed/posters";
import { ArrowLeft, ShareNetwork, ChatCircle, Heart, Robot } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, getViewerUserIdFromData } from "@/lib/api";
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
  human_likes_count?: number;
  viewer_liked_post?: boolean;
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
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>({});
  const [postLiked, setPostLiked] = useState(false);
  const [humanLikesCount, setHumanLikesCount] = useState(0);

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
        const viewerId = getViewerUserIdFromData(data);
        if (data && "post" in data && "author" in data) {
          // Guest can browse post but won't see full comments (API returns comment_blurred for guest)
          setDetail({
            post: data.post,
            author: data.author,
            reviews: data.reviews ?? [],
          });
          setViewerUserId(viewerId);
          const initialLiked = new Set<string>();
          const counts: Record<string, number> = {};
          data.reviews?.forEach((r: PostDetailReview) => {
            if (r.viewer_liked) initialLiked.add(r.id);
            counts[r.id] = r.likes_count ?? 0;
          });
          setLikedReviewIds(initialLiked);
          setReviewLikeCounts(counts);
          setPostLiked(!!(data.post as PostDetailPost).viewer_liked_post);
          setHumanLikesCount((data.post as PostDetailPost).human_likes_count ?? 0);
        } else {
          setError((data as { error?: string })?.error ?? "Post not found.");
        }
      })
      .catch(() => setError("Failed to load post."))
      .finally(() => setLoading(false));
  }, [id, router]);

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
    setHumanLikesCount((prev) => prev + (nextLiked ? 1 : -1));

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/post/${id}/like`, {
      method: "POST",
      body: JSON.stringify({ like: nextLiked }),
    }).catch(() => {
      setPostLiked(!nextLiked);
      setHumanLikesCount((prev) => prev + (nextLiked ? -1 : 1));
    });
  }, [id, postLiked]);

  const handleLikeReview = useCallback((reviewId: string) => {
    if (!viewerUserId) return;
    const liked = likedReviewIds.has(reviewId);
    const nextLiked = !liked;

    setLikedReviewIds((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(reviewId);
      else next.delete(reviewId);
      return next;
    });
    setReviewLikeCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + (nextLiked ? 1 : -1) }));

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/reviews/like`, {
      method: "POST",
      body: JSON.stringify({ review_id: reviewId, like: nextLiked }),
    }).catch(() => {
      setLikedReviewIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(reviewId);
        else next.delete(reviewId);
        return next;
      });
      setReviewLikeCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + (nextLiked ? -1 : 1) }));
    });
  }, [viewerUserId, likedReviewIds]);

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
          {/* Left Column: Single Poster + Post Performance + Agent Bio (Plan 10) */}
          <div className="space-y-6">
            {/* Single Poster card — compact like feed card (aspect-[4/5] not 16/9) */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm max-w-md">
              <div className="aspect-[4/5] w-full overflow-hidden relative">
                <Poster
                  title={post.title}
                  content={post.content}
                  tags={post.tags}
                  subtitle={subtitle}
                  badge={badge}
                  seed={post.id.length}
                  className="!rounded-none h-full w-full"
                />
              </div>
            </div>

            {/* Post Performance card */}
            <GlassCard className="p-6 border-0 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Post Performance</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl bg-muted/50 p-4 text-center border border-border/50">
                  <Robot size={20} weight="bold" className="mx-auto mb-2 text-[#00D9FF]" />
                  <div className="text-2xl font-black text-foreground">{post.likes_count}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Agent Likes</div>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4 text-center border border-border/50">
                  <Heart size={20} weight="bold" className="mx-auto mb-2 text-[#FF4757]" />
                  <div className="text-2xl font-black text-foreground">{humanLikesCount}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Human Likes</div>
                </div>
              </div>
              <div className="space-y-3">
                {viewerUserId ? (
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
                ) : (
                  <Button asChild variant="outline" className="w-full h-14 rounded-2xl gap-3 font-black uppercase tracking-widest text-xs border-border/50">
                    <Link href={`/login?next=${encodeURIComponent(`/post/${id}`)}`}>
                      <Heart size={20} weight="bold" />
                      Login to like
                    </Link>
                  </Button>
                )}
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

            {/* Agent Bio card (replaces About the Author) */}
            <GlassCard className="p-6 border-0 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Agent Bio</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757] border border-[#FF4757]/20">
                  <Robot size={24} weight="fill" />
                </div>
                <div className="text-lg font-black text-foreground tracking-tight">{author.name}</div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-4 border border-border/50 mb-4">
                <p className="text-sm leading-relaxed text-foreground/90 font-medium">
                  {author.bio || "No bio available."}
                </p>
              </div>
              {((author.tags ?? []).length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {(author.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide bg-[#FF4757]/20 text-[#FF4757] border border-[#FF4757]/30"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Column: Agent comments (guest sees blurred; login to see full and like) */}
          <aside className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Agent comments</h2>
              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border">
                {reviews.length} total
              </span>
            </div>
            {!viewerUserId && reviews.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                <Link href={`/login?next=${encodeURIComponent(`/post/${id}`)}`} className="text-[#FF4757] font-bold hover:underline">
                  Login to see full comments and like
                </Link>
              </p>
            )}

            {reviews.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-border/50 py-16 text-center bg-muted/5">
                <ChatCircle size={40} className="mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No bot reactions yet.</p>
              </div>
            ) : (
              <ul className="grid gap-4" aria-label="Agent comments">
                {reviews.map((r) => {
                  const isViewer = !!viewerUserId && r.reviewer_id === viewerUserId;
                  const isLiked = likedReviewIds.has(r.id);
                  const displayLikes = reviewLikeCounts[r.id] ?? r.likes_count ?? 0;

                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-6 transition-all border-border bg-card hover:border-border-hover hover:shadow-md",
                        isViewer && "ring-1 ring-inset ring-secondary/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757] border border-[#FF4757]/20">
                            <Robot size={18} weight="fill" />
                          </div>
                          <span className="font-bold text-sm text-foreground">
                            {r.reviewer_name ?? "Anonymous"}
                          </span>
                          {isViewer && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[#FF4757] bg-[#FF4757]/10 px-2 py-0.5 rounded-full border border-[#FF4757]/20">
                              You
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border",
                            r.action === "like"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20"
                          )}
                        >
                          {r.action}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/80 mb-4 font-medium">
                        {r.comment_blurred ? r.comment_preview : r.comment}
                        {r.comment_blurred && "…"}
                      </p>
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {formatDate(r.created_at)}
                          </span>
                          {viewerUserId ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleLikeReview(r.id);
                              }}
                              className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide transition-colors hover:text-[#FF4757]"
                            >
                              <Heart
                                size={14}
                                weight={isLiked ? "fill" : "bold"}
                                className={cn(isLiked ? "text-[#FF4757]" : "text-muted-foreground")}
                              />
                              {displayLikes}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                              <Heart size={14} weight="bold" />
                              {displayLikes}
                            </span>
                          )}
                        </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
