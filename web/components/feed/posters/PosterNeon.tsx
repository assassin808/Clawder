"use client";

type PosterNeonProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterNeon({ title, content, tags, subtitle, seed = 0 }: PosterNeonProps) {
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;

  // Neon color schemes
  const neonColors = [
    { bg: "#0a0a1f", glow: "#00ffff", secondary: "#ff00ff" }, // Cyan-Magenta
    { bg: "#1a0a2e", glow: "#ff00aa", secondary: "#00ffdd" }, // Pink-Cyan
    { bg: "#0f0f23", glow: "#39ff14", secondary: "#ff3399" }, // Green-Pink
    { bg: "#16213e", glow: "#ffff00", secondary: "#00d9ff" }, // Yellow-Cyan
    { bg: "#1f1f3a", glow: "#ff3366", secondary: "#00ffaa" }, // Red-Green
  ];

  const colors = neonColors[uniqueSeed % neonColors.length];
  
  // Grid animation
  const gridOpacity = 0.1 + (uniqueSeed % 15) / 100; // 0.1-0.25

  return (
    <div 
      className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden"
      style={{ 
        backgroundColor: colors.bg,
        backgroundImage: `
          linear-gradient(${colors.glow}22 1px, transparent 1px),
          linear-gradient(90deg, ${colors.glow}22 1px, transparent 1px)
        `,
        backgroundSize: '30px 30px'
      }}
    >
      {/* Glowing orbs */}
      <div 
        className="absolute top-1/4 -right-10 w-40 h-40 rounded-full blur-3xl"
        style={{ 
          backgroundColor: colors.glow,
          opacity: 0.2,
          animation: 'pulse 3s ease-in-out infinite'
        }}
      />
      <div 
        className="absolute bottom-1/4 -left-10 w-32 h-32 rounded-full blur-2xl"
        style={{ 
          backgroundColor: colors.secondary,
          opacity: 0.15,
          animation: 'pulse 4s ease-in-out infinite'
        }}
      />

      <div className="relative z-10">
        <h3 
          className="text-2xl font-black uppercase leading-tight mb-3 tracking-wide"
          style={{ 
            color: colors.glow,
            textShadow: `
              0 0 10px ${colors.glow},
              0 0 20px ${colors.glow},
              0 0 30px ${colors.glow}aa
            `
          }}
        >
          {title}
        </h3>
        {content && (
          <p 
            className="text-sm font-medium line-clamp-4 leading-relaxed"
            style={{ 
              color: '#ffffff',
              textShadow: `0 0 5px ${colors.secondary}66`
            }}
          >
            {content}
          </p>
        )}
      </div>

      {/* Scan line effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${colors.glow}11 2px,
            ${colors.glow}11 4px
          )`,
          animation: 'scan 8s linear infinite'
        }}
      />

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {subtitle && (
          <span 
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 border"
            style={{ 
              color: colors.secondary,
              borderColor: colors.secondary,
              boxShadow: `0 0 10px ${colors.secondary}66`
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
