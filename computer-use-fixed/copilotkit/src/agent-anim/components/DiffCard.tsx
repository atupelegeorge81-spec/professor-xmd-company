import { useMemo } from "react";
import { motion } from "motion/react";
import { IconPencil } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { cn } from "../lib/cn";
import { computeLineDiff, diffStats, type DiffLine } from "../lib/diff";
import { shortPath } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type DiffCardProps = ToolCardBaseProps & {
  path: string;
  /** Provide before/after, or pre-computed lines. */
  before?: string | undefined;
  after?: string | undefined;
  lines?: DiffLine[] | undefined;
};

/**
 * "Editing file" -> "Edited file" with a +/- stat badge and a unified diff
 * whose added/removed rows stagger in from the left.
 */
export function DiffCard({
  status,
  path,
  before = "",
  after = "",
  lines,
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
}: DiffCardProps) {
  const running = isRunning(status);
  const diff = useMemo(() => lines ?? computeLineDiff(before, after), [lines, before, after]);
  const stats = useMemo(() => diffStats(diff), [diff]);

  return (
    <ToolRow
      status={status}
      icon={<IconPencil size={13} />}
      activeLabel="Editing file"
      label="Edited file"
      detail={<code className="font-mono text-[12px]">{shortPath(path, 3)}</code>}
      trailing={
        !running ? (
          <span className="flex items-center gap-1 text-[10.5px] font-medium tabular-nums">
            <span className="text-px-success">+{stats.additions}</span>
            <span className="text-px-danger">-{stats.deletions}</span>
          </span>
        ) : null
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="max-h-64 overflow-auto rounded-px border border-px-border bg-px-bg font-mono text-[11.5px] leading-[1.6]">
        {diff.map((line, index) => (
          <motion.div
            key={`${index}-${line.content}`}
            initial={{ opacity: 0, x: line.type === "context" ? 0 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.4) }}
            className={cn(
              "flex gap-2 px-2 whitespace-pre-wrap",
              line.type === "add" && "bg-[var(--px-diff-add-bg)] text-[var(--px-diff-add-fg)]",
              line.type === "remove" && "bg-[var(--px-diff-del-bg)] text-[var(--px-diff-del-fg)]",
              line.type === "context" && "text-px-fg-muted",
            )}
          >
            <span className="w-8 shrink-0 select-none text-right text-px-fg-subtle tabular-nums">
              {line.newNumber ?? line.oldNumber ?? ""}
            </span>
            <span className="w-2 shrink-0 select-none">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="min-w-0 flex-1">{line.content || "\u00a0"}</span>
          </motion.div>
        ))}
      </div>
    </ToolRow>
  );
}
