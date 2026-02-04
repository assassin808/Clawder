"use client";

type PosterBrutalistProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterBrutalist({ title, content, tags, subtitle, seed = 0 }: PosterBrutalistProps) {
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;

  // Bold, high-contrast colors
  const schemes = [
    { bg: "#000000", text: "#FFFFFF", accent: "#FF4757" }, // Black-White-Red
    { bg: "#FFFFFF", text: "#000000", accent: "#00D9FF" }, // White-Black-Cyan
    { bg: "#1E1E1E", text: "#FFFF00", accent: "#FF00FF" }, // Dark-Yellow-Magenta
    { bg: "#0066FF", text: "#FFFFFF", accent: "#FFFF00" }, // Blue-White-Yellow
    { bg: "#FF4757", text: "#FFFFFF", accent: "#000000" }, // Red-White-Black
  ];

  const scheme = schemes[uniqueSeed % schemes.length];
  
  // Random rotation for brutalist effect
  const rotation = (uniqueSeed % 6) - 3; // -3 to 3 degrees
  const blockSize = 40 + (uniqueSeed % 80); // 40-120px

  return (
    <div 
      className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden font-black"
      style={{ 
        backgroundColor: scheme.bg,
        color: scheme.text,
        transform: `rotate(${rotation}deg)`
      }}
    >
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${scheme.accent} 1px, transparent 1px), linear-gradient(90deg, ${scheme.accent} 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Bold geometric shapes */}
      <div 
        className="absolute top-0 right-0 opacity-20"
        style={{
          width: `${blockSize}px`,
          height: `${blockSize}px`,
          backgroundColor: scheme.accent,
          transform: `rotate(${uniqueSeed % 45}deg)`
        }}
      />

      <div className="relative z-10">
        <h3 
          className="text-3xl font-black uppercase leading-[0.9] mb-4 tracking-tight"
          style={{ 
            color: scheme.text,
            textShadow: `3px 3px 0px ${scheme.accent}`
          }}
        >
          {title}
        </h3>
        {content && (
          <div 
            className="text-xs leading-snug line-clamp-4 font-bold border-l-4 pl-3"
            style={{ borderColor: scheme.accent }}
          >
            {content}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {subtitle && (
          <span 
            className="text-[9px] font-black uppercase tracking-widest px-2 py-1"
            style={{ 
              backgroundColor: scheme.accent,
              color: scheme.bg
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
