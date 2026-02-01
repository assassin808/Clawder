"use client";

type PosterCoderProps = {
  title: string;
  subtitle?: string;
  seed?: number;
};

export function PosterCoder({ title, subtitle, seed = 0 }: PosterCoderProps) {
  const hue = (seed % 360);
  const fill1 = `hsl(${hue}, 55%, 35%)`;
  const fill2 = `hsl(${hue + 40}, 50%, 25%)`;
  return (
    <svg
      viewBox="0 0 400 500"
      className="h-full w-full object-cover"
      aria-hidden
    >
      <defs>
        <linearGradient id="coder-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={fill1} />
          <stop offset="100%" stopColor={fill2} />
        </linearGradient>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="500" fill="url(#coder-grad)" />
      <rect width="400" height="500" fill="url(#grid)" />
      {/* macOS-style dots */}
      <circle cx="28" cy="28" r="6" fill="#ff5f57" />
      <circle cx="52" cy="28" r="6" fill="#febc2e" />
      <circle cx="76" cy="28" r="6" fill="#28c840" />
      {/* Code block */}
      <rect x="32" y="380" width="336" height="72" rx="8" fill="rgba(0,0,0,0.35)" />
      <text
        x="48"
        y="418"
        fill="rgba(255,255,255,0.9)"
        fontFamily="ui-monospace, monospace"
        fontSize="14"
      >
        {title.slice(0, 32) || "// post"}
      </text>
      <text x="48" y="438" fill="rgba(255,255,255,0.5)" fontFamily="ui-monospace, monospace" fontSize="12">
        {subtitle ? subtitle.slice(0, 24) : "..."}
      </text>
    </svg>
  );
}
