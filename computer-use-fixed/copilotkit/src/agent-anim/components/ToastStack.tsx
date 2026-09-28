import { AnimatePresence, motion } from "motion/react";
import { IconAlertTriangle, IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  title: string;
  description?: string | undefined;
  tone?: ToastTone | undefined;
};

export type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss?: ((id: string) => void) | undefined;
  className?: string | undefined;
};

const TONE: Record<ToastTone, { icon: typeof IconCheck; color: string }> = {
  info: { icon: IconInfoCircle, color: "text-px-accent" },
  success: { icon: IconCheck, color: "text-px-success" },
  error: { icon: IconAlertTriangle, color: "text-px-danger" },
};

/** Stacked toasts that slide in from the right and collapse on dismiss. */
export function ToastStack({ toasts, onDismiss, className }: ToastStackProps) {
  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-2", className)} role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const meta = TONE[toast.tone ?? "info"];
          const Icon = meta.icon;
          return (
            <motion.button
              type="button"
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={() => onDismiss?.(toast.id)}
              className="flex w-full items-start gap-2 rounded-px-lg border border-px-border bg-px-bg p-2.5 text-left shadow-sm"
            >
              <Icon size={14} className={cn("mt-0.5 shrink-0", meta.color)} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{toast.title}</span>
                {toast.description && (
                  <span className="block text-[11.5px] text-px-fg-muted">{toast.description}</span>
                )}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
