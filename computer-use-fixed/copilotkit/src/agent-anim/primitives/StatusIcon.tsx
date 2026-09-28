import { AnimatePresence, motion } from "motion/react";
import { IconAlertTriangle, IconCheck, IconMinus, IconX } from "@tabler/icons-react";
import { Spinner } from "./Spinner";
import { cn } from "../lib/cn";
import type { ToolStatus } from "../types";

export type StatusIconProps = {
  status: ToolStatus;
  size?: number | undefined;
  className?: string | undefined;
};

/**
 * Crossfades spinner -> check / cross when a step settles.
 * The check pops in with a short spring, the spinner fades out.
 */
export function StatusIcon({ status, size = 12, className }: StatusIconProps) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "running" || status === "pending" ? (
          <motion.span
            key="spin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 flex items-center justify-center text-px-accent"
          >
            <Spinner size={size} />
          </motion.span>
        ) : (
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 520, damping: 26 }}
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              status === "success" && "text-px-success",
              status === "error" && "text-px-danger",
              status === "cancelled" && "text-px-warning",
              status === "timeout" && "text-px-timeout",
            )}
          >
            {status === "success" && <IconCheck size={size} stroke={2.5} />}
            {status === "error" && <IconX size={size} stroke={2.5} />}
            {status === "cancelled" && <IconMinus size={size} stroke={2.5} />}
            {status === "timeout" && <IconAlertTriangle size={size} stroke={2.5} />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
