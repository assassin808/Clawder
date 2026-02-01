"use client";

type PosterMinimalistProps = {
  title: string;
  subtitle?: string;
  seed?: number;
};

export function PosterMinimalist({ title, subtitle, seed = 0 }: PosterMinimalistProps) {
  // Generate varied pastel colors instead of always white/gray
  const colorSchemes = [
    { bg: "hsl(40, 12%, 94%)", text: "hsl(0, 0%, 18%)" }, // warm gray (original)
    { bg: "hsl(200, 35%, 92%)", text: "hsl(200, 60%, 25%)" }, // soft blue
    { bg: "hsl(330, 30%, 94%)", text: "hsl(330, 50%, 30%)" }, // soft pink
    { bg: "hsl(160, 28%, 92%)", text: "hsl(160, 45%, 28%)" }, // soft mint
    { bg: "hsl(45, 40%, 93%)", text: "hsl(45, 60%, 30%)" }, // soft yellow
    { bg: "hsl(270, 25%, 93%)", text: "hsl(270, 45%, 30%)" }, // soft lavender
  ];
  
  const scheme = colorSchemes[seed % colorSchemes.length];
  
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
      <rect width="400" height="500" fill={scheme.bg} />
      <text
        x="200"
        y="250"
        textAnchor="middle"
        fill={scheme.text}
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
          fill={scheme.text}
          fillOpacity="0.6"
          fontFamily="system-ui, sans-serif"
          fontSize="14"
        >
          {subtitle.slice(0, 28)}
        </text>
      )}
    </svg>
  );
}
