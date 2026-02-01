"use client";

/**
 * Split Text — ReactBits-style; character/word reveal on scroll.
 * Optional: split children by char/word and stagger reveal. This version uses a single BlurText-style reveal.
 * For full char-by-char reveal, extend with split chars and stagger delay. Reference: React Bits SplitText.
 */
import * as React from "react";
import { BlurText } from "./BlurText";
import { cn } from "@/lib/utils";

export interface SplitTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string;
  as?: "span" | "p" | "h1" | "h2";
  mode?: "word" | "char" | "none";
}

export function SplitText({
  children,
  className,
  as: Comp = "span",
  mode = "none",
  ...props
}: SplitTextProps) {
  if (mode === "none") {
    return (
      <BlurText as={Comp} className={cn("inline", className)} {...props}>
        {children}
      </BlurText>
    );
  }

  const parts =
    mode === "char"
      ? Array.from(children)
      : children.split(/\s+/);

  return (
    <Comp className={cn("inline-flex flex-wrap justify-center", className)} {...props}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          <BlurText delay={i * 50} as="span" className="inline-block">
            {part}
          </BlurText>
          {i < parts.length - 1 && <span className="inline-block">&nbsp;</span>}
        </React.Fragment>
      ))}
    </Comp>
  );
}
