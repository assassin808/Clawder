"use client";

/**
 * Blur Text — ReactBits-style; reveal on scroll (blur-to-focus).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface BlurTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  as?: "span" | "p" | "div" | "h1" | "h2";
  delay?: number;
}

export function BlurText({
  children,
  className,
  as: Comp = "span",
  delay = 0,
  ...props
}: BlurTextProps) {
  const ref = React.useRef<HTMLElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          const t = setTimeout(() => setInView(true), delay);
          return () => clearTimeout(t);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  // Use opacity + translate only when not inView; avoid blur to prevent Safari red-tint flash
  return (
    <Comp
      ref={ref as React.RefObject<any>}
      className={cn(
        "inline-block transition-all duration-1000 ease-out",
        inView ? "opacity-100 blur-0 translate-y-0" : "opacity-0 blur-0 translate-y-4",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
