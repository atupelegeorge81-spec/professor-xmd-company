import { motion } from "motion/react";
import { IconClipboardList } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { ShimmerText } from "../primitives/ShimmerText";
import { StatusIcon } from "../primitives/StatusIcon";
import type { ToolStatus } from "../types";
import { isRunning } from "../types";

export type PlanItem = {
  id: string;
  title: string;
  detail?: string | undefined;
  status: ToolStatus;
};

export type PlanCardProps = {
  status: ToolStatus;
  title?: string | undefined;
  items: PlanItem[];
  /** Show Approve / Edit actions (plan-mode review step). */
  onApprove?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  className?: string | undefined;
};

/**
 * Plan review card, mirroring plan-mode in Cursor / Copilot / Lovable:
 * the agent drafts numbered steps, the user approves before execution.
 * Steps write themselves in one by one while the plan is being drafted.
 */
export function PlanCard({ status, title = "Plan", items, onApprove, onEdit, className }: PlanCardProps) {
  const drafting = isRunning(status);
  return (
    <motion.section
      layout
      className={cn("w-full rounded-px-lg border border-px-border bg-px-surface p-3", className)}
      aria-label={title}
    >
      <header className="mb-2 flex items-center gap-2 text-[13px] font-medium">
        <IconClipboardList size={14} className="text-px-fg-muted" />
        <ShimmerText active={drafting}>{drafting ? "Drafting plan" : title}</ShimmerText>
        <span className="ml-auto text-[11px] tabular-nums text-px-fg-subtle">
          {items.filter((item) => item.status === "success").length}/{items.length}
        </span>
      </header>

      <ol className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, delay: index * 0.06 }}
            className="flex gap-2 text-[12.5px] leading-5"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-px-surface-2 text-[10px] tabular-nums text-px-fg-muted">
              {item.status === "success" ? <StatusIcon status="success" size={10} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn(item.status === "success" && "text-px-fg-muted line-through")}>
                <ShimmerText active={isRunning(item.status) && !drafting}>{item.title}</ShimmerText>
              </span>
              {item.detail && <p className="text-[11.5px] text-px-fg-subtle">{item.detail}</p>}
            </span>
          </motion.li>
        ))}
      </ol>

      {(onApprove || onEdit) && !drafting && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-3 flex gap-2"
        >
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="rounded-full bg-px-accent px-3 py-1 text-[12px] font-medium text-white transition-transform hover:scale-[1.03] active:scale-95 dark:text-black"
            >
              Approve plan
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-px-border px-3 py-1 text-[12px] font-medium text-px-fg-muted transition-colors hover:bg-px-surface-2"
            >
              Edit
            </button>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}
