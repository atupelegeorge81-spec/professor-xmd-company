import { motion } from "motion/react";
import { IconLock, IconWorld } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { ProgressBar } from "../primitives/ProgressBar";
import { cn } from "../lib/cn";
import { hostname } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type WebBrowseCardProps = ToolCardBaseProps & {
  url: string;
  /** Page title once loaded. */
  title?: string | undefined;
  /** Screenshot URL of the loaded page. */
  screenshotUrl?: string | undefined;
};

/**
 * "Opening browser" -> "Visited page": a miniature browser chrome whose URL
 * bar fills with a loading bar, then reveals the page screenshot.
 */
export function WebBrowseCard({
  status,
  url,
  title,
  screenshotUrl,
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
}: WebBrowseCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconWorld size={13} />}
      activeLabel="Opening browser"
      label="Visited page"
      detail={title ?? hostname(url)}
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="overflow-hidden rounded-px border border-px-border bg-px-bg">
        <div className="flex items-center gap-2 border-b border-px-border bg-px-surface px-2.5 py-1.5">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-px-border-strong" />
            <span className="size-2 rounded-full bg-px-border-strong" />
            <span className="size-2 rounded-full bg-px-border-strong" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-px-bg px-2 py-0.5">
            <IconLock size={10} className="shrink-0 text-px-fg-subtle" />
            <span className="truncate font-mono text-[11px] text-px-fg-muted">{url}</span>
          </span>
        </div>
        {running ? (
          <div className="p-3">
            <ProgressBar label="Loading page" />
            <div className="mt-3 flex flex-col gap-2">
              <span className="px-skeleton-bg block h-3 w-2/3 rounded-full" />
              <span className="px-skeleton-bg block h-24 w-full rounded-px" />
            </div>
          </div>
        ) : (
          screenshotUrl && (
            <motion.img
              src={screenshotUrl}
              alt={title ? `Screenshot of ${title}` : `Screenshot of ${hostname(url)}`}
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn("block max-h-64 w-full object-cover object-top")}
              loading="lazy"
            />
          )
        )}
      </div>
    </ToolRow>
  );
}
