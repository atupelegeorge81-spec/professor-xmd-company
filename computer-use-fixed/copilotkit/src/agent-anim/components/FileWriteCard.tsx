import { motion } from "motion/react";
import { IconFilePlus } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { ProgressBar } from "../primitives/ProgressBar";
import { shortPath } from "../lib/format";
import { formatBytes } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type FileWriteCardProps = ToolCardBaseProps & {
  path: string;
  /** 0..1 write progress while running. Omit for the indeterminate sweep. */
  progress?: number | undefined;
  /** Final size in bytes. */
  bytes?: number | undefined;
  /** Lines added, shown as +N. */
  additions?: number | undefined;
};

/** "Creating file" -> "Created file", with a write progress bar. */
export function FileWriteCard({
  status,
  path,
  progress,
  bytes,
  additions,
  durationMs,
  startedAt,
  className,
}: FileWriteCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconFilePlus size={13} />}
      activeLabel="Creating file"
      label="Created file"
      detail={<code className="font-mono text-[12px]">{shortPath(path, 3)}</code>}
      trailing={
        <span className="flex items-center gap-1.5">
          {additions !== undefined && !running && (
            <span className="rounded-full bg-px-success-soft px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-px-success">
              +{additions}
            </span>
          )}
          {bytes !== undefined && !running && (
            <span className="text-[10.5px] tabular-nums text-px-fg-subtle">
              {formatBytes(bytes)}
            </span>
          )}
        </span>
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
    >
      {running ? (
        <div className="px-1 pb-1">
          <ProgressBar value={progress} label="Writing file" />
        </div>
      ) : null}
    </ToolRow>
  );
}

export type FileSavedPulseProps = {
  /** Flip to true the moment a write completes. */
  active: boolean;
  className?: string | undefined;
};

/** Short green wash over a row to confirm a file landed on disk. */
export function FileSavedPulse({ active, className }: FileSavedPulseProps) {
  return (
    <motion.span
      aria-hidden
      className={className}
      initial={false}
      animate={{ backgroundColor: active ? "var(--px-success-soft)" : "rgba(0,0,0,0)" }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      style={{ position: "absolute", inset: 0, borderRadius: "var(--px-radius)" }}
    />
  );
}
