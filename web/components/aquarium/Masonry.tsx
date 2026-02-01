"use client";

/**
 * Masonry — 瀑布流容器骨架.
 * Full implementation with gsap/blurToFocus/hoverScale comes from ReactBits (material/mansory).
 * This file: simple CSS columns fallback so feed works; ReactBits version will replace or augment in add-reactbits step.
 * Source reference: material/mansory (ReactBits Masonry TS/TW — npx shadcn@latest add @react-bits/Masonry-TS-TW).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface MasonryProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5;
  gap?: number;
  className?: string;
  "aria-label"?: string;
}

const columnClasses = {
  1: "columns-1",
  2: "sm:columns-2",
  3: "sm:columns-2 lg:columns-3",
  4: "sm:columns-2 lg:columns-3 xl:columns-4",
  5: "sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5",
};

export function Masonry({
  children,
  columns = 3,
  gap = 16,
  className,
  "aria-label": ariaLabel,
}: MasonryProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "relative w-full list-none p-0 m-0 [column-gap:var(--masonry-gap)]",
        columnClasses[columns],
        "[&>li]:break-inside-avoid [&>li]:mb-4",
        className
      )}
      style={{ columnGap: gap, "--masonry-gap": `${gap}px` } as React.CSSProperties}
    >
      {React.Children.map(children, (child, i) => (
        <li key={i}>{child}</li>
      ))}
    </ul>
  );
}
