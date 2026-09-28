import { motion } from "motion/react";
import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type StopGenerateButtonProps = {
  /** True while the agent is generating — the send arrow morphs into stop. */
  generating: boolean;
  disabled?: boolean | undefined;
  onSend?: (() => void) | undefined;
  onStop?: (() => void) | undefined;
  className?: string | undefined;
};

/** Composer button that morphs send -> stop while the agent runs. */
export function StopGenerateButton({
  generating,
  disabled = false,
  onSend,
  onStop,
  className,
}: StopGenerateButtonProps) {
  return (
    <motion.button
      type="button"
      layout
      disabled={disabled}
      aria-label={generating ? "Stop generating" : "Send message"}
      onClick={() => (generating ? onStop?.() : onSend?.())}
      whileTap={{ scale: 0.92 }}
      animate={{
        backgroundColor: generating ? "var(--px-surface-2)" : "var(--px-accent)",
        borderRadius: generating ? 10 : 999,
      }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={cn(
        "relative flex size-8 items-center justify-center text-white disabled:opacity-50 dark:text-black",
        generating && "text-px-fg",
        className,
      )}
    >
      {generating && (
        <span
          className="absolute inset-0 rounded-[10px] border border-px-accent/50"
          style={{ animation: "px-breathe 1.6s ease-in-out infinite" }}
        />
      )}
      <motion.span
        key={generating ? "stop" : "send"}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        {generating ? <IconPlayerStopFilled size={13} /> : <IconArrowUp size={16} stroke={2.4} />}
      </motion.span>
    </motion.button>
  );
}
