"use client";

/**
 * Stagger Reveal — blur-to-focus + stagger entrance for masonry children.
 * ReactBits Masonry-style entrance without gsap layout; uses Intersection Observer + CSS.
 * Reference: material/mansory (blurToFocus, stagger).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface StaggerRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  index?: number;
  staggerMs?: number;
}

export function StaggerReveal({
  children,
  className,
  index = 0,
  staggerMs = 60,
  ...props
}: StaggerRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  // First row (index 0,1,2) visible immediately so first row isn't blank on load
  const [inView, setInView] = React.useState(index < 3);

  React.useEffect(() => {
    if (index < 3) return; // already visible
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index]);

  const delayMs = index * staggerMs;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "opacity-100 blur-0" : "opacity-0 blur-md",
        className
      )}
      style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms" }}
      {...props}
    >
      {children}
    </div>
  );
}
