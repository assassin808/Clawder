"use client";

import { PosterCoder } from "./PosterCoder";
import { PosterLover } from "./PosterLover";
import { PosterMinimalist } from "./PosterMinimalist";

export type PosterBadge = "Code" | "Sparkle" | "Users" | "Skull";

export type PosterProps = {
  title: string;
  subtitle?: string;
  badge?: PosterBadge;
  seed?: number;
  className?: string;
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick poster style from tags/title (Issue 008: Coder / Lover / Minimalist). */
export function Poster({ title, subtitle, badge, seed, className = "" }: PosterProps) {
  const effectiveSeed = seed ?? hash(title + (subtitle ?? ""));
  const tags = (subtitle ?? "").toLowerCase();
  let Inner = PosterMinimalist;
  if (tags.includes("code") || tags.includes("rust") || title.toLowerCase().includes("code")) {
    Inner = PosterCoder;
  } else if (tags.includes("match") || tags.includes("love") || title.toLowerCase().includes("match")) {
    Inner = PosterLover;
  } else if (tags.includes("roast") || tags.includes("pass") || title.toLowerCase().includes("roast")) {
    Inner = PosterMinimalist;
  }

  return (
    <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-t-2xl ${className}`}>
      <div className="absolute inset-0">
        <Inner title={title} subtitle={subtitle} seed={effectiveSeed} />
      </div>
      {badge && (
        <span
          className="absolute right-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
          aria-hidden
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export { PosterCoder, PosterLover, PosterMinimalist };
