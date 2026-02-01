"use client";

import Link from "next/link";
import { GlassCard, HeartLike } from "@/components/aquarium";
import { Poster, type PosterBadge } from "./posters";
import { ChatCircle, ThumbsUp, X } from "@/components/icons";
import { cn } from "@/lib/utils";

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
const PAYWALL_CTA = "Pay $0.99 to see the full roast";

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
  onLikePost?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onLikeReview?: (reviewId: string) => void;
};

export function FeedCard({ item, isPro = false, viewerUserId, isLiked = false, onLikePost, onHide, onLikeReview }: FeedCardProps) {
  const { post, author } = item;
  const reviews = item.live_reviews ?? item.featured_reviews ?? [];
  const tag = author.tags?.[0];
  const subtitle = [author.name, tag].filter(Boolean).join(" · ");
  const badge = pickBadge([...(post.tags ?? []), ...(author.tags ?? [])]);

  return (
    <div className="block break-inside-avoid mb-4">
      <Link href={`/post/${post.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
        <GlassCard as="article" className="overflow-hidden border-0 relative group">
          {/* Layer 1: Poster */}
          <Poster
            title={post.title}
            content={post.content}
            tags={post.tags}
            subtitle={subtitle}
            badge={badge}
            seed={post.id.length}
          />

          {/* Layer 2: Meta — comments count + Save/Hide (stopPropagation) */}
          <div className="flex items-center justify-between gap-2 bg-card px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-bold text-secondary-foreground shrink-0 uppercase">
                {author.name.slice(0, 1)}
              </div>
              <span className="truncate text-xs font-semibold text-foreground/90">
                {author.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-muted-foreground/80">
              <div className="flex items-center gap-1 text-[11px] font-medium">
                <ChatCircle size={14} weight="bold" />
                <span>{post.reviews_count}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium">
                <ThumbsUp size={14} weight="bold" className={cn(isLiked && "text-primary")} />
                <span>{post.likes_count}</span>
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
                const likesCount = r.likes_count ?? 0;
                const viewerLiked = r.viewer_liked ?? false;

                return (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[11px] leading-tight",
                      isViewer && "bg-secondary/10 ring-1 ring-secondary/20",
                      !showFull && "relative"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
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
                      </div>
                      {isPro && onLikeReview && (
                        <HeartLike
                          liked={viewerLiked}
                          count={likesCount}
                          onClick={() => onLikeReview(r.id)}
                          className="shrink-0"
                        />
                      )}
                    </div>
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
      </Link>
    </div>
  );
}
