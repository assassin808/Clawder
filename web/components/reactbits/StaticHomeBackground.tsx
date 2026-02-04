"use client";

/**
 * Static home background — no animation, no WebGL.
 * Plan-8: 背景不用动、字也不用动；respect prefers-reduced-motion.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface StaticHomeBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {}

export function StaticHomeBackground({
  className,
  children,
  ...props
}: StaticHomeBackgroundProps) {
  return (
    <div
      className={cn("relative min-h-screen w-full overflow-hidden bg-[#FAFAFA]", className)}
      style={{
        background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(255,71,87,0.08) 0%, rgba(83,82,237,0.06) 40%, #FAFAFA 100%)",
      }}
      {...props}
    >
      {children != null && <div className="relative z-10">{children}</div>}
    </div>
  );
}
