import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconPointer } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type CursorPoint = {
  /** Percentage of the frame width / height (0..100). */
  x: number;
  y: number;
  /** Draw a click ripple at this point. */
  click?: boolean | undefined;
  label?: string | undefined;
};

export type LiveCursorOverlayProps = {
  /** The frame being controlled — a screenshot, iframe, or placeholder. */
  children: ReactNode;
  point?: CursorPoint | undefined;
  className?: string | undefined;
};

/**
 * Computer-use pointer: the cursor glides to the target coordinate and a
 * ripple expands on click. Used over screenshots of the sandbox desktop.
 */
export function LiveCursorOverlay({ children, point, className }: LiveCursorOverlayProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-px", className)}>
      {children}
      <AnimatePresence>
        {point && (
          <motion.div
            key="cursor"
            className="pointer-events-none absolute"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: `${point.x}%`, top: `${point.y}%` }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            {point.click && (
              <span
                className="absolute -left-3 -top-3 size-6 rounded-full bg-px-accent/50"
                style={{ animation: "px-pulse-ring 700ms ease-out 1" }}
              />
            )}
            <IconPointer size={18} className="relative drop-shadow text-px-accent" fill="currentColor" />
            {point.label && (
              <span className="absolute left-4 top-4 whitespace-nowrap rounded-full bg-px-accent px-2 py-0.5 text-[10.5px] font-medium text-white">
                {point.label}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
