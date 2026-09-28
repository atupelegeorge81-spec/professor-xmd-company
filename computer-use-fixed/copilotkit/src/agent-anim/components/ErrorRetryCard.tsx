import { motion } from "motion/react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { cleanTerminalOutput } from "../lib/ansi";

export type ErrorRetryCardProps = {
  title?: string | undefined;
  /** Error text; ANSI escapes are stripped. */
  message: string;
  /** Current attempt number, 1-based. */
  attempt?: number | undefined;
  maxAttempts?: number | undefined;
  /** While true the card shows a retry spinner instead of the button. */
  retrying?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
};

/**
 * Error card with a short shake on mount and an attempt counter, matching the
 * "error card + retry affordance" pattern in Agent Elements.
 */
export function ErrorRetryCard({
  title = "Step failed",
  message,
  attempt,
  maxAttempts,
  retrying = false,
  onRetry,
  className,
}: ErrorRetryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: [-6, 5, -3, 0] }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      role="alert"
      className={cn(
        "w-full rounded-px-lg border border-[color-mix(in_oklab,var(--px-danger)_35%,transparent)] bg-px-danger-soft p-3",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[13px] font-medium text-px-danger">
        <IconAlertTriangle size={14} />
        {title}
        {attempt !== undefined && (
          <span className="ml-auto text-[11px] tabular-nums font-normal text-px-fg-muted">
            attempt {attempt}
            {maxAttempts ? `/${maxAttempts}` : ""}
          </span>
        )}
      </p>
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-[1.5] text-px-fg-muted">
        {cleanTerminalOutput(message)}
      </pre>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-px-border bg-px-bg px-3 py-1 text-[12px] font-medium transition-colors hover:bg-px-surface disabled:opacity-60"
        >
          <motion.span
            animate={retrying ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.8, repeat: retrying ? Infinity : 0, ease: "linear" }}
            className="inline-flex"
          >
            <IconRefresh size={12} />
          </motion.span>
          {retrying ? "Retrying" : "Retry"}
        </button>
      )}
    </motion.div>
  );
}
