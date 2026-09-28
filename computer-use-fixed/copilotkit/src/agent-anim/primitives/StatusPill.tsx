import { motion } from "motion/react";
import { StatusDot } from "./StatusDot";
import { cn } from "../lib/cn";
import type { StatusTone, ToolStatus } from "../types";
import { STATUS_TONE } from "../types";

export type StatusPillProps = {
  status: ToolStatus;
  /** Override the label; defaults to the status word. */
  label?: string | undefined;
  tone?: StatusTone | undefined;
  className?: string | undefined;
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-px-surface-2 text-px-fg-muted",
  accent: "bg-px-accent-soft text-px-accent",
  success: "bg-px-success-soft text-px-success",
  warning: "bg-px-warning-soft text-px-warning",
  danger: "bg-px-danger-soft text-px-danger",
  timeout: "bg-px-timeout-soft text-px-timeout",
};

const DEFAULT_LABEL: Record<ToolStatus, string> = {
  pending: "Queued",
  running: "Running",
  success: "Done",
  error: "Failed",
  cancelled: "Stopped",
  timeout: "Timed out",
};

/** Compact status chip that animates its width/colour when the status flips. */
export function StatusPill({ status, label, tone, className }: StatusPillProps) {
  const resolved = tone ?? STATUS_TONE[status];
  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-px-pill px-2 py-0.5 text-[11px] font-medium leading-4",
        "rounded-full transition-colors duration-200",
        TONE_CLASS[resolved],
        className,
      )}
    >
      <StatusDot tone={resolved} pulsing={status === "running"} size={5} />
      <motion.span key={label ?? status} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {label ?? DEFAULT_LABEL[status]}
      </motion.span>
    </motion.span>
  );
}
