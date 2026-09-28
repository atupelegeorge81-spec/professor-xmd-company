import { AnimatePresence, motion } from "motion/react";
import { IconShieldLock } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";

export type ApprovalPromptProps = {
  /** What the agent wants to do, e.g. `rm -rf build`. */
  request: string;
  /** Extra context line. */
  reason?: string | undefined;
  /** Decision already taken; when set the prompt collapses to a result row. */
  decision?: ApprovalDecision | undefined;
  onDecide?: ((decision: ApprovalDecision) => void) | undefined;
  className?: string | undefined;
};

const DECISION_LABEL: Record<ApprovalDecision, string> = {
  "allow-once": "Allowed once",
  "allow-always": "Always allowed",
  deny: "Denied",
};

/**
 * Permission prompt for risky tool calls (Claude Code style):
 * the card slides up with a warning tint, and after a decision it collapses
 * into a single muted confirmation row.
 */
export function ApprovalPrompt({ request, reason, decision, onDecide, className }: ApprovalPromptProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {decision ? (
        <motion.div
          key="decided"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={cn("flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-px-fg-muted", className)}
        >
          <IconShieldLock size={13} />
          {DECISION_LABEL[decision]} · <code className="font-mono">{request}</code>
        </motion.div>
      ) : (
        <motion.div
          key="prompt"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={cn(
            "w-full rounded-px-lg border border-[color-mix(in_oklab,var(--px-warning)_40%,transparent)] bg-px-warning-soft p-3",
            className,
          )}
          role="alertdialog"
          aria-label="Permission required"
        >
          <p className="flex items-center gap-2 text-[13px] font-medium text-px-warning">
            <IconShieldLock size={14} />
            Permission required
          </p>
          <code className="mt-2 block overflow-auto rounded-px bg-px-code-bg px-2.5 py-1.5 font-mono text-[11.5px] text-px-code-fg">
            {request}
          </code>
          {reason && <p className="mt-1.5 text-[12px] text-px-fg-muted">{reason}</p>}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDecide?.("allow-once")}
              className="rounded-full bg-px-accent px-3 py-1 text-[12px] font-medium text-white transition-transform hover:scale-[1.03] active:scale-95 dark:text-black"
            >
              Allow once
            </button>
            <button
              type="button"
              onClick={() => onDecide?.("allow-always")}
              className="rounded-full border border-px-border bg-px-bg px-3 py-1 text-[12px] font-medium transition-colors hover:bg-px-surface"
            >
              Always allow
            </button>
            <button
              type="button"
              onClick={() => onDecide?.("deny")}
              className="rounded-full border border-px-border px-3 py-1 text-[12px] font-medium text-px-danger transition-colors hover:bg-px-danger-soft"
            >
              Deny
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
