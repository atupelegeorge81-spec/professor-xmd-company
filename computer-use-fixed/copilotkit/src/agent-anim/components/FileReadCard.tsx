import { IconFileText } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { Skeleton } from "../primitives/Skeleton";
import { shortPath } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type FileReadCardProps = ToolCardBaseProps & {
  path: string;
  /** Number of lines read, shown as a badge when finished. */
  lineCount?: number | undefined;
  /** Preview content revealed on expand. */
  preview?: string | undefined;
};

/**
 * "Reading file" -> "Read file" with a skeleton preview while loading
 * and a real excerpt once the observation lands.
 */
export function FileReadCard({
  status,
  path,
  lineCount,
  preview,
  durationMs,
  startedAt,
  className,
  defaultExpanded,
  onToggle,
}: FileReadCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconFileText size={13} />}
      activeLabel="Reading file"
      label="Read file"
      detail={<code className="font-mono text-[12px]">{shortPath(path, 3)}</code>}
      trailing={
        !running && lineCount !== undefined ? (
          <span className="rounded-full bg-px-surface-2 px-1.5 py-0.5 text-[10.5px] tabular-nums text-px-fg-muted">
            {lineCount} lines
          </span>
        ) : null
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
      onToggle={onToggle}
    >
      {running ? (
        <div className="flex flex-col gap-1.5 px-1">
          <Skeleton width="88%" />
          <Skeleton width="70%" />
          <Skeleton width="94%" />
        </div>
      ) : (
        preview && (
          <pre className="max-h-52 overflow-auto rounded-px bg-px-code-bg px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-px-code-fg">
            {preview}
          </pre>
        )
      )}
    </ToolRow>
  );
}
