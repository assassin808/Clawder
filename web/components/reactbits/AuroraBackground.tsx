"use client";

/**
 * Aurora Background — Now using WebGL Iridescence for the "wow" factor.
 * Color Guide: secondary (#5352ED) and primary (#FF4757) mix.
 */
import * as React from "react";
import { Iridescence } from "./Iridescence";
import { cn } from "@/lib/utils";

export interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  className,
  showRadialGradient = true,
  children,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn("relative min-h-screen w-full overflow-hidden bg-[#FAFAFA]", className)}
      {...props}
    >
      <div className="absolute inset-0 opacity-60">
        <Iridescence
          color={[1, 1, 1]}
          speed={0.25} 
          amplitude={0.12} 
          mouseReact={true}
          className="h-full w-full"
        />
      </div>

      {showRadialGradient && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, transparent 0%, #FAFAFA 80%)`,
          }}
        />
      )}
      {children != null && <div className="relative z-10">{children}</div>}
    </div>
  );
}
