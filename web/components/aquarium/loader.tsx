/**
 * Bouncing square loader (material/loading). Uses global .loader-box from globals.css.
 */
export function Loader({ className }: { className?: string }) {
  return (
    <div
      className={className ? `loader-box ${className}` : "loader-box"}
      role="status"
      aria-label="Loading"
    />
  );
}
