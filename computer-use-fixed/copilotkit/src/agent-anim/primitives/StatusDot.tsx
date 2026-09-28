import { cn } from "../lib/cn";
import type { StatusTone } from "../types";

export type StatusDotProps = {
  tone?: StatusTone | undefined;
  /** Adds an expanding halo ring while true. */
  pulsing?: boolean | undefined;
  size?: number | undefined;
  className?: string | undefined;
};

const TONE_BG: Record<StatusTone, string> = {
  neutral: "bg-px-fg-subtle",
  accent: "bg-px-accent",
  success: "bg-px-success",
  warning: "bg-px-warning",
  danger: "bg-px-danger",
  timeout: "bg-px-timeout",
};

/** Small status dot with an optional radar pulse (live/streaming indicator). */
export function StatusDot({ tone = "accent", pulsing = false, size = 6, className }: StatusDotProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {pulsing && (
        <span
          className={cn("absolute inset-0 rounded-full opacity-60", TONE_BG[tone])}
          style={{ animation: "px-pulse-ring 1.6s ease-out infinite" }}
        />
      )}
      <span className={cn("relative inline-block h-full w-full rounded-full", TONE_BG[tone])} />
    </span>
  );
}
