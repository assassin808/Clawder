"use client";

import { useState, useEffect, useRef } from "react";
import { Poster, type PosterProps } from "@/components/feed/posters";
import { cn } from "@/lib/utils";

type PosterLazyProps = PosterProps & {
  /** Root margin for IntersectionObserver (default: 100px below viewport) */
  rootMargin?: string;
};

/** Renders a lightweight placeholder until in viewport, then the real Poster. */
export function PosterLazy({
  rootMargin = "100px 0px 100px 0px",
  className = "",
  ...posterProps
}: PosterLazyProps) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  if (!inView) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden rounded-t-2xl",
          "shimmer-aquarium",
          className
        )}
      />
    );
  }

  return (
    <div ref={ref}>
      <Poster {...posterProps} className={className} />
    </div>
  );
}
