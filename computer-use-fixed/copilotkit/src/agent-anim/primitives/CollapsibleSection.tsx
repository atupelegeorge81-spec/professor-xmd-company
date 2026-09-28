import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../lib/cn";

export type CollapsibleSectionProps = {
  open: boolean;
  children: ReactNode;
  className?: string | undefined;
  /** Seconds. */
  duration?: number | undefined;
};

/** Height + opacity collapse used by every expandable tool card. */
export function CollapsibleSection({
  open,
  children,
  className,
  duration = 0.22,
}: CollapsibleSectionProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
