import { cn } from "../lib/cn";

export type SpinnerProps = {
  /** Pixel size of the square spinner. */
  size?: number | undefined;
  /** Stroke width in pixels. */
  thickness?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
};

/**
 * Arc spinner used on every running tool row (Cursor / Claude Code style:
 * a thin 270-degree arc, not a full ring).
 */
export function Spinner({ size = 12, thickness = 1.5, className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block shrink-0 align-middle", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${thickness}px solid color-mix(in oklab, currentColor 22%, transparent)`,
        borderTopColor: "currentColor",
        animation: "px-spin var(--px-spin-duration) linear infinite",
      }}
    />
  );
}
