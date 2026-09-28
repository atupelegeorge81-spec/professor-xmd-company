import { motion } from "motion/react";
import { IconGitCommit, IconHistory } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type CheckpointCardProps = {
  label: string;
  /** Human timestamp, e.g. "2 min ago". */
  timestamp?: string | undefined;
  /** Summary chips, e.g. ["3 files", "+48 -6"]. */
  chips?: string[] | undefined;
  /** Current checkpoint is highlighted. */
  current?: boolean | undefined;
  onRollback?: (() => void) | undefined;
  className?: string | undefined;
};

/**
 * Environment checkpoint marker with a rollback action
 * (the Replit Agent checkpoint / rollback pattern).
 */
export function CheckpointCard({
  label,
  timestamp,
  chips = [],
  current = false,
  onRollback,
  className,
}: CheckpointCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-px border px-2.5 py-2 text-[12.5px] transition-colors",
        current
          ? "border-px-accent bg-px-accent-soft"
          : "border-px-border bg-px-surface hover:border-px-border-strong",
        className,
      )}
    >
      <IconGitCommit size={14} className={current ? "text-px-accent" : "text-px-fg-muted"} />
      <span className="truncate font-medium">{label}</span>
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full bg-px-surface-2 px-1.5 py-0.5 text-[10.5px] text-px-fg-muted"
        >
          {chip}
        </span>
      ))}
      {timestamp && <span className="ml-auto text-[11px] text-px-fg-subtle">{timestamp}</span>}
      {onRollback && (
        <button
          type="button"
          onClick={onRollback}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-px-border bg-px-bg px-2 py-0.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <IconHistory size={11} />
          Rollback
        </button>
      )}
    </motion.div>
  );
}
