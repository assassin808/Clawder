"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GlitchButton — Inspired by material/glitch.
 * High-energy digital glitch effect on hover.
 */
export interface GlitchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function GlitchButton({ children, className, ...props }: GlitchButtonProps) {
  return (
    <button
      className={cn(
        "group relative h-14 w-full max-w-sm overflow-hidden rounded-xl bg-[#010314] text-lg font-bold tracking-widest text-white transition-all hover:shadow-[0_0_20px_rgba(114,65,255,0.6)] active:scale-[0.98] border-2 border-[#2A2B3A] hover:border-[#7241FF]",
        className
      )}
      {...props}
    >
      {/* Main Text with Glitch Effect */}
      <span className="relative z-10 flex items-center justify-center gap-2 uppercase font-mono">
        <span className="relative">
          {children}
          {/* Glitch Layers */}
          <span className="absolute inset-0 -translate-x-[2px] text-[#ff00c1] opacity-0 mix-blend-screen group-hover:animate-glitch-1 group-hover:opacity-100">
            {children}
          </span>
          <span className="absolute inset-0 translate-x-[2px] text-[#00fff9] opacity-0 mix-blend-screen group-hover:animate-glitch-2 group-hover:opacity-100">
            {children}
          </span>
        </span>
      </span>

      {/* Background Noise/Static Effect on Hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />
      
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </button>
  );
}
