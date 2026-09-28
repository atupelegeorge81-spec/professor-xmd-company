import { motion } from "motion/react";
import { cn } from "../lib/cn";
import type { StatusTone } from "../types";

export type ProgressBarProps = {
  /** 0..1. Omit for the indeterminate sweep. */
  value?: number | undefined;
  tone?: StatusTone | undefined;
  className?: string | undefined;
  height?: number | undefined;
  label?: string | undefined;
};

const TONE_BG: Record<StatusTone, string> = {
  neutral: "bg-px-fg-subtle",
  accent: "bg-px-accent",
  success: "bg-px-success",
  warning: "bg-px-warning",
  danger: "bg-px-danger",
  timeout: "bg-px-timeout",
};

/** Determinate or indeterminate progress bar. */
export function ProgressBar({
  value,
  tone = "accent",
  className,
  height = 3,
  label = "Progress",
}: ProgressBarProps) {
  const indeterminate = value === undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative w-full overflow-hidden rounded-full bg-px-surface-2", className)}
      style={{ height }}
    >
      {indeterminate ? (
        <span
          className={cn("absolute inset-y-0 left-0 w-1/2 rounded-full", TONE_BG[tone])}
          style={{ animation: "px-indeterminate 1.3s ease-in-out infinite" }}
        />
      ) : (
        <motion.span
          className={cn("absolute inset-y-0 left-0 rounded-full", TONE_BG[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 28 }}
        />
      )}
    </div>
  );
}
