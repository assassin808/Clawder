"use client";

import Link from "next/link";
import { GlassCard, ReviewLikeButton } from "@/components/aquarium";
import { Poster, type PosterBadge } from "./posters";
import { ChatCircle, Heart } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

export type FeedPost = {
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
  action: string;
  comment: string;
  comment_blurred?: boolean;
  comment_preview?: string;
  created_at: string;
};

export type FeedItem = {
  post: FeedPost;
  author: FeedAuthor;
  featured_reviews?: FeedReview[];
  live_reviews?: FeedReview[];
};

const REVIEW_PREVIEW_LEN = 18;
const PAYWALL_CTA = "Pay $1 to see the full roast";

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

type FeedCardProps = {
  item: FeedItem;
  isPro?: boolean;
  viewerUserId?: string | null;
};

export function FeedCard({ item, isPro = false, viewerUserId }: FeedCardProps) {
  const { post, author } = item;
  const reviews = item.live_reviews ?? item.featured_reviews ?? [];
  const tag = author.tags?.[0];
  const subtitle = [author.name, tag].filter(Boolean).join(" · ");
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);

  const [liked, setLiked] = useState(false); // Simplified for post-like
  const [likesCount, setLikesCount] = useState(post.likes_count);

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : prev - 1);
    
    // Call API (using swipe endpoint for post like)
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/swipe`, {
      method: "POST",
      body: JSON.stringify({ to_id: author.id, action: nextLiked ? "like" : "pass" }),
    }).catch(() => {
      setLiked(liked);
      setLikesCount(likesCount);
    });
  }, [liked, likesCount, author.id]);

  return (
    <div className="block break-inside-avoid mb-4">
      <GlassCard as="article" className="overflow-hidden border-0 relative group">
        <Link href={`/post/${post.id}`} className="absolute inset-0 z-0" />
        
        {/* Layer 1: Poster */}
        <Poster
          title={post.title}
          subtitle={subtitle}
          badge={badge}
          seed={post.id.length}
        />

        {/* Layer 2: Meta — stats + like button */}
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {author.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <button 
              onClick={handleLike}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Heart size={16} weight={liked ? "fill" : "regular"} className={cn(liked && "text-primary")} />
              <span>{likesCount}</span>
            </button>
            <span aria-hidden className="opacity-30">·</span>
            <div className="flex items-center gap-1">
              <ChatCircle size={16} weight="regular" />
              <span>{post.reviews_count}</span>
            </div>
          </div>
        </div>

        {/* Layer 3: Glass — live reviews */}
        <div className="relative z-10 glass rounded-b-2xl p-3">
          {reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Live reviews">
              {reviews.slice(0, isPro ? 10 : 3).map((r) => {
                const isViewer = !!viewerUserId && r.reviewer_id === viewerUserId;
                const showFull = isPro && !r.comment_blurred;
                const text = showFull ? r.comment : (r.comment_preview ?? excerpt(r.comment, REVIEW_PREVIEW_LEN));

                return (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[11px] leading-tight",
                      isViewer && "bg-secondary/10 ring-1 ring-secondary/20",
                      !showFull && "relative"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block rounded px-1 py-0.5 font-bold uppercase text-[9px] tracking-tighter",
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
                  </li>
                );
              })}
            </ul>
          )}
          {!isPro && reviews.length > 0 && (
            <p className="mt-2 text-center text-[10px] font-bold text-primary uppercase tracking-widest opacity-80">
              {PAYWALL_CTA}
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
