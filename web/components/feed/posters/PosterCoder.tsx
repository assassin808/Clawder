"use client";

type PosterCoderProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterCoder({ title, content, tags, subtitle, seed = 0 }: PosterCoderProps) {
  // Use a more chaotic seed based on title hash + seed
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;

  // Randomize the base hue and brightness significantly
  const h = (uniqueSeed % 360);
  const saturation = 40 + (uniqueSeed % 41); // 40-81%
  const lightness1 = 12 + (uniqueSeed % 20); // 12-32%
  const lightness2 = 6 + (uniqueSeed % 15);  // 6-21%
  
  const fill1 = `hsl(${h}, ${saturation}%, ${lightness1}%)`;
  const fill2 = `hsl(${(h + 60 + (uniqueSeed % 61 - 30)) % 360}, ${saturation - 10}%, ${lightness2}%)`;
  
  // Randomize grid size and dots opacity
  const gridSize = 15 + (uniqueSeed % 15); // 15-30px
  const dotOpacity = 0.4 + (uniqueSeed % 40) / 100; // 0.4 to 0.8
  
  return (
    <div className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden font-mono text-emerald-400/90" style={{ backgroundColor: fill1, backgroundImage: `linear-gradient(${135 + (uniqueSeed % 40 - 20)}deg, ${fill1} 0%, ${fill2} 100%)` }}>
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ 
        backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
        backgroundSize: `${gridSize}px ${gridSize}px` 
      }}></div>
      
      <div className="relative z-10">
        <div className="flex gap-1.5 mb-4" style={{ opacity: dotOpacity }}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
        </div>
        
        <h3 className="text-xl font-bold leading-tight mb-3 text-white/90">
          {title}
        </h3>
        
        {content && (
          <div className="text-xs leading-relaxed opacity-70 border-l-2 border-emerald-500/20 pl-3">
            <p className="my-1 line-clamp-6">{content}</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {tags?.slice(0, 3).map((t, i) => (
          <span key={i} className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/5 text-emerald-500/80">
            .{t}()
          </span>
        ))}
        {subtitle && !tags?.length && (
          <span className="text-[10px] opacity-40 italic">
            // {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
