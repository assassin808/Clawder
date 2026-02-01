"use client";

/**
 * Review Like Button — Uiverse-style “嘭” burst on click.
 * Color Guide: #FF4757 (Primary); review-like only, never for post-like.
 */
import * as React from "react";
import { Heart } from "@/components/icons";
import { cn } from "@/lib/utils";

const BURST_DOTS = 8;
const BURST_RADIUS = 28;

export interface ReviewLikeButtonProps {
  liked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function ReviewLikeButton({
  liked,
  onToggle,
  disabled = false,
  className,
}: ReviewLikeButtonProps) {
  const [burst, setBurst] = React.useState(false);

  const handleClick = () => {
    if (disabled) return;
    if (!liked) setBurst(true);
    onToggle();
  };

  React.useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(false), 600);
    return () => clearTimeout(t);
  }, [burst]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-colors",
        "hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        liked && "border-primary/30 bg-primary/10",
        className
      )}
      aria-pressed={liked}
      aria-label={liked ? "Unlike review" : "Like review"}
    >
      {/* Burst dots — Uiverse-style */}
      {burst &&
        Array.from({ length: BURST_DOTS }).map((_, i) => {
          const angle = (i / BURST_DOTS) * 2 * Math.PI;
          const x = Math.cos(angle) * BURST_RADIUS;
          const y = Math.sin(angle) * BURST_RADIUS;
            return (
              <span
                key={i}
                className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#FF4757]"
                style={{
                  ["--bx" as string]: `${x}px`,
                  ["--by" as string]: `${y}px`,
                  animation: "heart-burst-dot 0.6s ease-out forwards",
                } as React.CSSProperties}
              />
            );
        })}
      <Heart
        size={22}
        weight={liked ? "fill" : "regular"}
        className={cn("relative z-10", liked ? "text-[#FF4757]" : "text-muted-foreground")}
      />
    </button>
  );
}
