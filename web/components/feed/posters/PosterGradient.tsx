"use client";

type PosterGradientProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterGradient({ title, content, tags, subtitle, seed = 0 }: PosterGradientProps) {
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;

  // Vibrant gradient colors
  const colorSets = [
    { start: "hsl(280, 80%, 50%)", mid: "hsl(320, 90%, 60%)", end: "hsl(350, 85%, 55%)" }, // Purple-Pink-Red
    { start: "hsl(180, 75%, 45%)", mid: "hsl(200, 80%, 55%)", end: "hsl(240, 85%, 60%)" }, // Cyan-Blue-Purple
    { start: "hsl(30, 90%, 55%)", mid: "hsl(350, 85%, 60%)", end: "hsl(320, 80%, 55%)" }, // Orange-Red-Pink
    { start: "hsl(260, 75%, 55%)", mid: "hsl(180, 80%, 50%)", end: "hsl(120, 75%, 45%)" }, // Purple-Cyan-Green
    { start: "hsl(340, 85%, 55%)", mid: "hsl(40, 90%, 60%)", end: "hsl(180, 80%, 50%)" }, // Pink-Yellow-Cyan
  ];

  const colors = colorSets[uniqueSeed % colorSets.length];
  const angle = 120 + (uniqueSeed % 120); // 120-240deg

  // Animated wave pattern
  const waveOpacity = 0.15 + (uniqueSeed % 20) / 100; // 0.15-0.35

  return (
    <div 
      className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden text-white"
      style={{ 
        background: `linear-gradient(${angle}deg, ${colors.start} 0%, ${colors.mid} 50%, ${colors.end} 100%)`
      }}
    >
      {/* Animated wave overlay */}
      <div 
        className="absolute inset-0 pointer-events-none animate-pulse"
        style={{
          opacity: waveOpacity,
          background: `repeating-linear-gradient(
            ${(angle + 90) % 360}deg,
            transparent,
            transparent 20px,
            rgba(255, 255, 255, 0.1) 20px,
            rgba(255, 255, 255, 0.1) 40px
          )`
        }}
      />

      {/* Floating shapes */}
      <div className="absolute top-10 right-10 w-24 h-24 rounded-full bg-white/10 blur-xl" />
      <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full bg-white/5 blur-2xl" />

      <div className="relative z-10">
        <h3 className="text-2xl font-black leading-tight mb-3 drop-shadow-lg">
          {title}
        </h3>
        {content && (
          <p className="text-sm font-medium line-clamp-5 leading-relaxed text-white/95">
            {content}
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {subtitle && (
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
