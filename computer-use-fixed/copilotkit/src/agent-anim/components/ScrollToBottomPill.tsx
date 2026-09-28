import { AnimatePresence, motion } from "motion/react";
import { IconArrowDown } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type ScrollToBottomPillProps = {
  /** Show the pill when the user has scrolled away from the latest message. */
  visible: boolean;
  /** Number of unseen messages. */
  count?: number | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
};

/** "Jump to latest" pill that pops up when auto-follow is broken. */
export function ScrollToBottomPill({ visible, count, onClick, className }: ScrollToBottomPillProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-px-border bg-px-bg px-3 py-1 text-[12px] font-medium shadow-sm",
            className,
          )}
        >
          <IconArrowDown size={12} />
          {count ? `${count} new` : "Jump to latest"}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
