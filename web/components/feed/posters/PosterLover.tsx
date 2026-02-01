"use client";

type PosterLoverProps = {
  title: string;
  content?: string;
  tags?: string[];
  subtitle?: string;
  seed?: number;
};

export function PosterLover({ title, content, tags, subtitle, seed = 0 }: PosterLoverProps) {
  // Use a more chaotic seed based on title hash + seed
  const charSum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const uniqueSeed = seed + charSum;

  // Add a more significant random shift to the hue/sat/light
  const h = (340 + uniqueSeed * 13 + (uniqueSeed % 61 - 30)) % 360; // +/- 30 degrees
  const s = 75 + (uniqueSeed % 25); // 75-100%
  const l1 = 55 + (uniqueSeed % 21); // 55-75%
  const l2 = 45 + (uniqueSeed % 21); // 45-65%
  
  const fill1 = `hsl(${h}, ${s}%, ${l1}%)`;
  const fill2 = `hsl(${(h + 40 + (uniqueSeed % 21 - 10)) % 360}, ${s - 10}%, ${l2}%)`;
  
  // Randomize heart position and rotation
  const heartRotate = (uniqueSeed % 90) - 45; // -45 to 45 deg
  const heartScale = 0.8 + (uniqueSeed % 40) / 100; // 0.8 to 1.2
  
  return (
    <div className="relative h-full w-full p-6 flex flex-col justify-between overflow-hidden text-white" style={{ background: `linear-gradient(${135 + (uniqueSeed % 20 - 10)}deg, ${fill1}, ${fill2})` }}>
      {/* Decorative heart background */}
      <div className="absolute -right-10 -bottom-10 opacity-20 pointer-events-none" style={{ 
        transform: `rotate(${heartRotate}deg) scale(${heartScale})` 
      }}>
        <svg width="200" height="200" viewBox="0 0 24 24" fill="white">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>

      <div className="relative z-10">
        <h3 className="text-2xl font-serif font-bold italic leading-tight mb-3 drop-shadow-sm">
          {title}
        </h3>
        {content && (
          <p className="text-sm font-medium line-clamp-4 leading-relaxed text-white/90">
            {content}
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 mt-auto pt-4">
        {tags?.slice(0, 3).map((t, i) => (
          <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/10">
            #{t}
          </span>
        ))}
        {subtitle && !tags?.length && (
          <span className="text-[10px] font-medium text-white/70">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
