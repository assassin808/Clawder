"use client";

/**
 * Bouncing square loader from material/loading.
 * Use size="sm" for buttons/inline, default for page loading.
 */
export function BoxLoader({
  size = "default",
  className = "",
}: {
  size?: "default" | "sm";
  className?: string;
}) {
  const baseClass = size === "sm" ? "loader-box loader-box-sm" : "loader-box";
  return (
    <div
      className={className ? `${baseClass} ${className}` : baseClass}
      role="status"
      aria-label="Loading"
    />
  );
}
