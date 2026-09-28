import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { IconChevronRight, IconStack2 } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { ShimmerText } from "../primitives/ShimmerText";
import { StatusIcon } from "../primitives/StatusIcon";
import { DurationTicker } from "../primitives/DurationTicker";
import { CollapsibleSection } from "../primitives/CollapsibleSection";
import type { ToolCardBaseProps, ToolStatus } from "../types";
import { isRunning } from "../types";

export type TaskGroupItem = {
  id: string;
  label: string;
  status: ToolStatus;
  /** Optional detail row rendered under the item. */
  content?: ReactNode | undefined;
};

export type TaskGroupCardProps = ToolCardBaseProps & {
  /** Title while running, e.g. "Working on the login page". */
  activeLabel?: string | undefined;
  /** Title once finished, e.g. "Task completed". */
  label?: string | undefined;
  items: TaskGroupItem[];
  /** Summary chips, e.g. ["1 file", "1 search"]. */
  summary?: string[] | undefined;
};

/**
 * Groups several tool calls into one card — the missing "task grouping"
 * layer. Collapsed it reads "Task completed · 1 file · 1 search"; expanded
 * it lists every sub-step with its own status icon.
 */
export function TaskGroupCard({
  status,
  activeLabel = "Working",
  label = "Task completed",
  items,
  summary,
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
}: TaskGroupCardProps) {
  const running = isRunning(status);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const done = items.filter((item) => item.status === "success").length;

  return (
    <motion.div
      layout
      className={cn(
        "w-full overflow-hidden rounded-px-lg border border-px-border bg-px-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px]"
      >
        <IconStack2 size={14} className="shrink-0 text-px-fg-muted" />
        <span className="font-medium">
          <ShimmerText active={running}>{running ? activeLabel : label}</ShimmerText>
        </span>

        <span className="ml-1 flex min-w-0 flex-wrap items-center gap-1">
          {(summary ?? []).map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-px-surface-2 px-1.5 py-0.5 text-[10.5px] text-px-fg-muted"
            >
              {chip}
            </span>
          ))}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-[11px] tabular-nums text-px-fg-subtle">
            {done}/{items.length}
          </span>
          <DurationTicker running={running} startedAt={startedAt} durationMs={durationMs} />
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.16 }}>
            <IconChevronRight size={13} className="text-px-fg-subtle" />
          </motion.span>
        </span>
      </button>

      <CollapsibleSection open={expanded}>
        <ul className="flex flex-col gap-1 border-t border-px-border px-3 py-2">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="flex flex-col gap-1"
            >
              <span className="flex items-center gap-2 text-[12.5px]">
                <StatusIcon status={item.status} />
                <span className={cn(item.status === "success" && "text-px-fg-muted")}>
                  <ShimmerText active={isRunning(item.status)}>{item.label}</ShimmerText>
                </span>
              </span>
              {item.content}
            </motion.li>
          ))}
        </ul>
      </CollapsibleSection>
    </motion.div>
  );
}
