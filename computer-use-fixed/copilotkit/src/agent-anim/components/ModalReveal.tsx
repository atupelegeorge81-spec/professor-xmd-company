import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconX } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type ModalRevealProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
};

/** Scrim fade + panel spring-scale, used for artifact and preview modals. */
export function ModalReveal({ open, title, children, onClose, className }: ModalRevealProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4"
          onClick={onClose}
        >
          <motion.div
            key="panel"
            role="dialog"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "w-full max-w-lg rounded-px-lg border border-px-border bg-px-bg p-4 shadow-xl",
              className,
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-[13.5px] font-semibold">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto rounded-full p-1 text-px-fg-muted transition-colors hover:bg-px-surface"
              >
                <IconX size={14} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
