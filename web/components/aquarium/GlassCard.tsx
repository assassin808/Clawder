"use client";

/**
 * Glass Card — Event card container with hover/active触感.
 * Adapted from material/main-card (Uiverse.io by SteveBloX).
 * Uses Aquarium tokens: --glass-bg, --glass-border, --glass-shadow.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "article" | "section";
}

export function GlassCard({ className, as: Comp = "div", ...props }: GlassCardProps) {
  return (
    <Comp
      className={cn(
        "glass rounded-2xl border transition-all duration-300 ease-out",
        "hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]",
        "active:scale-[0.98] active:shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
        "cursor-pointer select-none",
        className
      )}
      {...props}
    />
  );
}
