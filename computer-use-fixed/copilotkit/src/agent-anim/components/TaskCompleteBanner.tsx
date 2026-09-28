import { motion } from "motion/react";
import { IconCircleCheck } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { formatDuration } from "../lib/format";

export type TaskCompleteBannerProps = {
  title?: string | undefined;
  /** Summary chips, e.g. ["3 files changed", "12 tools"]. */
  chips?: string[] | undefined;
  totalMs?: number | undefined;
  className?: string | undefined;
};

/** Closing banner: icon springs in, a soft success wash sweeps across once. */
export function TaskCompleteBanner({
  title = "Task completed",
  chips = [],
  totalMs,
  className,
}: TaskCompleteBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "relative w-full overflow-hidden rounded-px-lg border border-[color-mix(in_oklab,var(--px-success)_35%,transparent)] bg-px-success-soft px-3 py-2.5",
        className,
      )}
      role="status"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/25"
        initial={{ x: "-120%" }}
        animate={{ x: "320%" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <div className="relative flex flex-wrap items-center gap-2 text-[13px]">
        <motion.span
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="text-px-success"
        >
          <IconCircleCheck size={16} />
        </motion.span>
        <span className="font-medium">{title}</span>
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-px-bg/70 px-1.5 py-0.5 text-[10.5px] text-px-fg-muted"
          >
            {chip}
          </span>
        ))}
        {totalMs !== undefined && (
          <span className="ml-auto text-[11px] tabular-nums text-px-fg-muted">
            {formatDuration(totalMs)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
