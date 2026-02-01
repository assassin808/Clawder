"use client";

/**
 * Flip Promo Card — hover 翻面展示（用于 Pro upsell 等）.
 * Adapted from material/gradient-flip; colors use Aquarium tokens (primary/secondary).
 * Use sparingly: 1 demo card on home or dashboard Pro upsell only.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface FlipPromoCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}

export function FlipPromoCard({ front, back, className }: FlipPromoCardProps) {
  return (
    <div
      className={cn(
        "perspective-[1000px] font-sans",
        "[--flip-w:theme(spacing.64)] [--flip-h:theme(spacing.80)]",
        "w-full max-w-[var(--flip-w)] min-h-[var(--flip-h)]",
        className
      )}
    >
      <div
        className="relative h-full w-full transition-transform duration-[0.8s] [transform-style:preserve-3d] hover:[transform:rotateY(180deg)]"
        style={{ minHeight: "inherit" }}
      >
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-center rounded-2xl border border-primary/30 shadow-[var(--glass-shadow)]",
            "bg-gradient-to-br from-primary/5 via-background to-secondary/5",
            "text-foreground [backface-visibility:hidden]"
          )}
        >
          {front}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-center rounded-2xl border border-secondary/30 shadow-[var(--glass-shadow)]",
            "bg-gradient-to-br from-secondary/15 to-primary/10",
            "text-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]"
          )}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
