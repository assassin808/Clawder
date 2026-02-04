"use client";

import { cn } from "@/lib/utils";
import { PosterCoder } from "./PosterCoder";
import { PosterLover } from "./PosterLover";
import { PosterMinimalist } from "./PosterMinimalist";
import { PosterGradient } from "./PosterGradient";
import { PosterBrutalist } from "./PosterBrutalist";
import { PosterNeon } from "./PosterNeon";

export type PosterBadge = "Code" | "Sparkle" | "Users" | "Skull";

export type PosterProps = {
  title: string;
  content?: string;
  tags?: string[];
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

/** Pick poster style from tags/title/content with more variety. */
export function Poster({ title, content, tags: postTags, subtitle, badge, seed, className = "" }: PosterProps) {
  const effectiveSeed = seed ?? hash(title + (subtitle ?? ""));
  const tagsStr = ((subtitle ?? "") + " " + (title ?? "")).toLowerCase();
  const contentStr = (content ?? "").toLowerCase();
  
  // Keyword-based style selection (expanded)
  let Inner;
  
  if (tagsStr.includes("code") || tagsStr.includes("rust") || tagsStr.includes("tech") || contentStr.includes("function") || contentStr.includes("debug")) {
    Inner = PosterCoder;
  } else if (tagsStr.includes("match") || tagsStr.includes("love") || tagsStr.includes("heart") || contentStr.includes("relationship")) {
    Inner = PosterLover;
  } else if (tagsStr.includes("neon") || tagsStr.includes("cyber") || tagsStr.includes("future") || contentStr.includes("electric")) {
    Inner = PosterNeon;
  } else if (tagsStr.includes("bold") || tagsStr.includes("brutal") || tagsStr.includes("punk") || contentStr.includes("manifesto")) {
    Inner = PosterBrutalist;
  } else if (tagsStr.includes("gradient") || tagsStr.includes("colorful") || tagsStr.includes("vibrant") || contentStr.includes("spectrum")) {
    Inner = PosterGradient;
  } else {
    // Distribute remaining posts across all styles based on seed
    const styles = [PosterMinimalist, PosterGradient, PosterBrutalist, PosterNeon, PosterCoder, PosterLover];
    Inner = styles[effectiveSeed % styles.length];
  }

  return (
    <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-t-2xl ${className}`}>
      <div className="absolute inset-0">
        <Inner title={title} content={content} tags={postTags} subtitle={subtitle} seed={effectiveSeed} />
      </div>
    </div>
  );
}

export { PosterCoder, PosterLover, PosterMinimalist, PosterGradient, PosterBrutalist, PosterNeon };
