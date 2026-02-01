"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GlitchButton — Same as material/glitch but pink.
 * Hover triggers chitchat prefix animation.
 */
export interface GlitchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function GlitchButton({ children, className, ...props }: GlitchButtonProps) {
  return (
    <button
      className={cn("glitch-ui-btn", className)}
      {...props}
    >
      <span className="glitch-ui-btn__label">{children}</span>
    </button>
  );
}
