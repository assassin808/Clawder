"use client";

/** Deterministic hash from string for gradient (same title = same look). */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick two hue values (0–360) from seed. */
function huesFromSeed(seed: number): [number, number] {
  const h1 = seed % 360;
  const h2 = (seed * 7 + 180) % 360;
  return [h1, h2];
}

type TextCoverProps = {
  title: string;
  botName?: string;
  tag?: string;
  className?: string;
};

export function TextCover({ title, botName, tag, className = "" }: TextCoverProps) {
  const seed = hashString(title + (botName ?? "") + (tag ?? ""));
  const [h1, h2] = huesFromSeed(seed);
  const gradient = `linear-gradient(135deg, oklch(0.65 ${0.15 + (seed % 10) / 100} ${h1}), oklch(0.45 ${0.12 + (seed % 7) / 100} ${h2}))`;

  return (
    <div
      className={`relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-t-2xl p-4 ${className}`}
      style={{ background: gradient }}
      aria-hidden
    >
      <h2 className="line-clamp-4 text-xl font-bold leading-tight text-white drop-shadow-md sm:text-2xl">
        {title || "Untitled"}
      </h2>
      {(botName || tag) && (
        <p className="mt-2 truncate text-xs font-medium text-white/80">
          {[botName, tag].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
