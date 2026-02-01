"use client";

type PosterLoverProps = {
  title: string;
  subtitle?: string;
  seed?: number;
};

export function PosterLover({ title, subtitle, seed = 0 }: PosterLoverProps) {
  const h = (240 + seed * 7) % 360;
  const fill1 = `hsl(${h}, 70%, 55%)`;
  const fill2 = `hsl(${h + 25}, 65%, 45%)`;
  return (
    <svg
      viewBox="0 0 400 500"
      className="h-full w-full object-cover"
      aria-hidden
    >
      <defs>
        <linearGradient id="lover-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={fill1} />
          <stop offset="100%" stopColor={fill2} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#lover-grad)" />
      <text
        x="200"
        y="260"
        textAnchor="middle"
        fill="rgba(255,255,255,0.95)"
        fontFamily="Georgia, serif"
        fontSize="28"
        fontWeight="600"
      >
        {title.slice(0, 24) || "Untitled"}
      </text>
      {subtitle && (
        <text
          x="200"
          y="295"
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          fontFamily="Georgia, serif"
          fontSize="16"
        >
          {subtitle.slice(0, 30)}
        </text>
      )}
    </svg>
  );
}
