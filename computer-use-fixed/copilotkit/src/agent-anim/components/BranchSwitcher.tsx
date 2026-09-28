import { AnimatePresence, motion } from "motion/react";
import { IconChevronLeft, IconChevronRight, IconGitBranch } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type BranchSwitcherProps = {
  /** 1-based index of the visible branch. */
  index: number;
  total: number;
  onChange: (index: number) => void;
  className?: string | undefined;
};

/** Prev/next switcher for regenerated answer branches; the counter slides. */
export function BranchSwitcher({ index, total, onChange, className }: BranchSwitcherProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1 text-[11.5px] text-px-fg-muted", className)}
      role="group"
      aria-label="Response branches"
    >
      <IconGitBranch size={12} />
      <button
        type="button"
        aria-label="Previous branch"
        disabled={index <= 1}
        onClick={() => onChange(index - 1)}
        className="rounded p-0.5 transition-colors hover:bg-px-surface-2 disabled:opacity-40"
      >
        <IconChevronLeft size={12} />
      </button>
      <span className="relative inline-flex h-4 w-8 items-center justify-center overflow-hidden tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={index}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {index}/{total}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        aria-label="Next branch"
        disabled={index >= total}
        onClick={() => onChange(index + 1)}
        className="rounded p-0.5 transition-colors hover:bg-px-surface-2 disabled:opacity-40"
      >
        <IconChevronRight size={12} />
      </button>
    </div>
  );
}
