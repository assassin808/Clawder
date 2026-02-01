"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fancy Button — "Digital Aquarium" style.
 * Subtle chromatic aberration and liquid shimmer on hover.
 * Not "geeky" glitch, but "high-end fluid" glitch.
 */
export interface FancyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function FancyButton({ children, className, ...props }: FancyButtonProps) {
  return (
    <button
      className={cn(
        "group relative h-14 w-full max-w-sm overflow-hidden rounded-full bg-[#FF4757] text-lg font-semibold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {/* Liquid Shimmer Layer */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      
      {/* Subtle "Glitch" / Chromatic Aberration Layers (only visible on hover) */}
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-200 group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:opacity-30 group-hover:text-cyan-300">
        {children}
      </span>
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-200 group-hover:-translate-x-[1px] group-hover:-translate-y-[1px] group-hover:opacity-30 group-hover:text-yellow-300">
        {children}
      </span>
      
      {/* Main Text */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      
      {/* Border Glow and Fancy Liquid Effect */}
      <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/10 via-transparent to-yellow-400/10 mix-blend-overlay animate-pulse" />
      </div>
    </button>
  );
}
