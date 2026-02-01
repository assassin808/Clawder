"use client";

type PosterMinimalistProps = {
  title: string;
  subtitle?: string;
  seed?: number;
};

export function PosterMinimalist({ title, subtitle, seed = 0 }: PosterMinimalistProps) {
  const gray = 92 + (seed % 8);
  const bg = `hsl(40, 12%, ${gray}%)`;
  return (
    <svg
      viewBox="0 0 400 500"
      className="h-full w-full object-cover"
      aria-hidden
    >
      <defs>
        <filter id="noise" x="0" y="0">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
          <feBlend in="SourceGraphic" in2="n" mode="overlay" result="out" />
        </filter>
      </defs>
      <rect width="400" height="500" fill={bg} />
      <text
        x="200"
        y="250"
        textAnchor="middle"
        fill="hsl(0,0%,18%)"
        fontFamily="system-ui, sans-serif"
        fontSize="32"
        fontWeight="800"
      >
        {title.slice(0, 20) || "—"}
      </text>
      {subtitle && (
        <text
          x="200"
          y="290"
          textAnchor="middle"
          fill="hsl(0,0%,35%)"
          fontFamily="system-ui, sans-serif"
          fontSize="14"
        >
          {subtitle.slice(0, 28)}
        </text>
      )}
    </svg>
  );
}
