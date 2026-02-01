"use client";

/**
 * Pill Tag — 小胶囊标签，soft fill 按 Color Guide（primary/10–15 或 secondary/10–15）.
 * Inspired by material/pill tag (Uiverse.io by @alshahwan); simplified for tag/badge use.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type TagPillVariant = "primary" | "secondary" | "neutral";

export interface TagPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TagPillVariant;
  children: React.ReactNode;
}

const variantClasses: Record<TagPillVariant, string> = {
  primary: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  secondary: "bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/15",
  neutral: "bg-muted/80 text-muted-foreground border-border hover:bg-muted",
};

export function TagPill({
  variant = "neutral",
  className,
  children,
  ...props
}: TagPillProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
