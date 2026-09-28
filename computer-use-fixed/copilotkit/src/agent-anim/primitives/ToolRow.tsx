import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { ShimmerText } from "./ShimmerText";
import { StatusIcon } from "./StatusIcon";
import { DurationTicker } from "./DurationTicker";
import { CollapsibleSection } from "./CollapsibleSection";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type ToolRowProps = ToolCardBaseProps & {
  /** Leading tool icon. */
  icon?: ReactNode | undefined;
  /** Label shown while running, e.g. "Reading file". */
  activeLabel: string;
  /** Label shown once settled, e.g. "Read file". */
  label: string;
  /** Secondary muted text, e.g. the file path. */
  detail?: ReactNode | undefined;
  /** Right-aligned extra content (badges, counts). */
  trailing?: ReactNode | undefined;
  /** Expandable body. */
  children?: ReactNode | undefined;
  /** Show the duration ticker. */
  showDuration?: boolean | undefined;
  /** Auto-open while running, auto-close when it settles. */
  autoCollapseOnComplete?: boolean | undefined;
};

/**
 * The single row primitive every tool card is built on.
 *
 * Ongoing:   spinner + shimmering present-tense label + live duration
 * Completed: check/cross + static past-tense label + frozen duration
 * Hover:     row background lifts, chevron darkens
 * Expand:    chevron rotates 90deg, body animates open
 */
export function ToolRow({
  status,
  icon,
  activeLabel,
  label,
  detail,
  trailing,
  children,
  durationMs,
  startedAt,
  className,
  defaultExpanded = false,
  onToggle,
  showDuration = true,
  autoCollapseOnComplete = false,
}: ToolRowProps) {
  const running = isRunning(status);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(
    defaultExpanded ? true : null,
  );
  const auto = autoCollapseOnComplete ? running : false;
  const expanded = userExpanded ?? auto;
  const expandable = Boolean(children);

  const toggle = () => {
    if (!expandable) return;
    const next = !expanded;
    setUserExpanded(next);
    onToggle?.(next);
  };

  return (
    <div
      className={cn(
        "group w-full rounded-px border border-transparent px-2 py-1.5 transition-colors duration-200",
        "hover:border-px-border hover:bg-px-surface",
        expanded && "border-px-border bg-px-surface",
        className,
      )}
      data-status={status}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!expandable}
        aria-expanded={expandable ? expanded : undefined}
        className={cn(
          "flex w-full items-center gap-2 text-left text-[13px] leading-5",
          expandable ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center text-px-fg-muted">
          {icon ?? <StatusIcon status={status} />}
        </span>

        <span className="shrink-0 font-medium">
          <ShimmerText active={running}>{running ? activeLabel : label}</ShimmerText>
        </span>

        {detail && (
          <span className="min-w-0 flex-1 truncate font-normal text-px-fg-muted">{detail}</span>
        )}

        <span className={cn("ml-auto flex shrink-0 items-center gap-2 pl-2", detail && "ml-0")}>
          {trailing}
          {showDuration && (
            <DurationTicker running={running} startedAt={startedAt} durationMs={durationMs} />
          )}
          {expandable && (
            <motion.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="text-px-fg-subtle transition-colors group-hover:text-px-fg-muted"
            >
              <IconChevronRight size={13} />
            </motion.span>
          )}
        </span>
      </button>

      {expandable && (
        <CollapsibleSection open={expanded}>
          <div className="pt-2">{children}</div>
        </CollapsibleSection>
      )}
    </div>
  );
}
