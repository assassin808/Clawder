"use client";

type PosterMinimalistProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterMinimalist({ title, content, tags, subtitle, seed = 0 }: PosterMinimalistProps) {
  // Generate varied pastel colors instead of always white/gray
  const colorSchemes = [
    { bg: "hsl(40, 40%, 92%)", text: "hsl(0, 0%, 20%)", accent: "hsl(0, 0%, 40%)" }, // warm beige
    { bg: "hsl(200, 55%, 92%)", text: "hsl(200, 70%, 25%)", accent: "hsl(200, 50%, 45%)" }, // soft blue
    { bg: "hsl(330, 50%, 92%)", text: "hsl(330, 60%, 30%)", accent: "hsl(330, 50%, 50%)" }, // soft pink
    { bg: "hsl(160, 45%, 92%)", text: "hsl(160, 55%, 25%)", accent: "hsl(160, 45%, 45%)" }, // soft mint
    { bg: "hsl(45, 60%, 92%)", text: "hsl(45, 70%, 30%)", accent: "hsl(45, 60%, 45%)" }, // soft yellow
    { bg: "hsl(270, 45%, 92%)", text: "hsl(270, 55%, 30%)", accent: "hsl(270, 45%, 50%)" }, // soft lavender
    { bg: "hsl(10, 50%, 92%)", text: "hsl(10, 60%, 30%)", accent: "hsl(10, 50%, 50%)" }, // soft coral
    { bg: "hsl(180, 45%, 92%)", text: "hsl(180, 60%, 25%)", accent: "hsl(180, 50%, 45%)" }, // soft cyan
    { bg: "hsl(300, 40%, 92%)", text: "hsl(300, 55%, 30%)", accent: "hsl(300, 45%, 50%)" }, // soft orchid
    { bg: "hsl(80, 40%, 92%)", text: "hsl(80, 60%, 25%)", accent: "hsl(80, 50%, 45%)" }, // soft lime
    { bg: "hsl(220, 50%, 92%)", text: "hsl(220, 60%, 25%)", accent: "hsl(220, 50%, 45%)" }, // soft sky
    { bg: "hsl(350, 45%, 92%)", text: "hsl(350, 60%, 30%)", accent: "hsl(350, 50%, 50%)" }, // soft rose
  ];
  
  // Use seed to pick a scheme and also add a slight random hue/saturation shift
  const scheme = colorSchemes[seed % colorSchemes.length];
  
  // Extract HSL values to apply slight randomization
  const match = scheme.bg.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  let finalBg = scheme.bg;
  let gradientBg = "";
  
  // Use a more chaotic seed based on title hash + seed to ensure uniqueness per post
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;
  
  if (match) {
    const isWhite = parseInt(match[2]) === 0; // Saturation 0 means white/gray scale
    
    const h1 = (parseInt(match[1]) + (uniqueSeed % 41 - 20) + 360) % 360; 
    const s1 = Math.max(25, Math.min(100, parseInt(match[2]) + (uniqueSeed % 21 - 10)));
    const l1 = Math.max(90, Math.min(95, parseInt(match[3]) + (uniqueSeed % 11 - 5)));
    
    finalBg = `hsl(${h1}, ${s1}%, ${l1}%)`;

    // 10% chance of solid color, 90% chance of gradient
    if (uniqueSeed % 10 < 1) {
      gradientBg = ""; // Keep as solid color
    } else {
      // Create a second color for gradient
      const h2 = (h1 + (uniqueSeed % 100 + 30)) % 360; 
      const s2 = Math.max(30, Math.min(100, s1 + (uniqueSeed % 20 - 5)));
      const l2 = Math.max(85, Math.min(92, l1 - (uniqueSeed % 8 + 3))); // Slightly darker but still very light
      
      const color2 = `hsl(${h2}, ${s2}%, ${l2}%)`;
      
      if (uniqueSeed % 10 < 4) { // 30% chance of radial
        const h3 = (h2 + 40) % 360;
        gradientBg = `radial-gradient(circle at ${uniqueSeed % 100}% ${uniqueSeed % 70}%, ${finalBg} 0%, ${color2} 70%, hsl(${h3}, ${s2}%, ${l2}%) 100%)`;
      } else { // 60% chance of linear
        gradientBg = `linear-gradient(${uniqueSeed % 360}deg, ${finalBg} 0%, ${color2} 100%)`;
      }
    }
  }
  
  // Randomize noise opacity and scale slightly
  const noiseOpacity = 0.03 + (uniqueSeed % 40) / 1000; // 0.03 to 0.07
  const noiseScale = 0.4 + (uniqueSeed % 60) / 100; // 0.4 to 1.0
  
  return (
    <div className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden" style={{ background: gradientBg || finalBg }}>
      {/* Soft overlay to keep it "minimalist" and ensure text readability */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] pointer-events-none"></div>
      
      <div className="absolute inset-0 pointer-events-none" style={{ 
        opacity: noiseOpacity,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${noiseScale}' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
      }}></div>
      
      <div className="relative z-10">
        <h3 className="text-2xl font-black leading-tight tracking-tight mb-2" style={{ color: scheme.text }}>
          {title}
        </h3>
        {content && (
          <p className="text-sm line-clamp-4 leading-relaxed opacity-70" style={{ color: scheme.text }}>
            {content}
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {tags?.slice(0, 3).map((t, i) => (
          <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5" style={{ color: scheme.accent }}>
            #{t}
          </span>
        ))}
        {subtitle && !tags?.length && (
          <span className="text-[10px] font-medium opacity-50" style={{ color: scheme.text }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
