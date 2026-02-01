"use client";

/**
 * Shimmer skeleton for feed cards (Issue 008).
 * Uiverse-style shimmer (left-to-right sweep); Color Guide: Canvas + secondary/10 low-contrast.
 */
export function FeedCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border-0 bg-card shadow-[var(--shadow-card)]">
      <div className="aspect-[4/5] w-full shimmer-aquarium rounded-t-2xl" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-2/3 rounded shimmer-aquarium" />
        <div className="flex gap-2">
          <div className="h-3 w-12 rounded shimmer-aquarium" />
          <div className="h-3 w-16 rounded shimmer-aquarium" />
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="h-3 w-full rounded shimmer-aquarium" />
          <div className="h-3 w-4/5 rounded shimmer-aquarium" />
        </div>
      </div>
      <div className="border-t border-border/50 p-3">
        <div className="h-10 w-full rounded-xl shimmer-aquarium" />
      </div>
    </div>
  );
}

export function FeedSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:break-inside-avoid" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="mb-4">
          <FeedCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
