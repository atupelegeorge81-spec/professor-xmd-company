import { useElapsed } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { cn } from "../lib/cn";

export type DurationTickerProps = {
  /** While true the value counts up in real time. */
  running: boolean;
  /** Epoch ms when the step started. */
  startedAt?: number | undefined;
  /** Final duration once finished. */
  durationMs?: number | undefined;
  className?: string | undefined;
  prefix?: string | undefined;
};

/**
 * Live "12.4s" counter while a step runs, frozen final value afterwards.
 * Tabular numerals keep the row from jittering.
 */
export function DurationTicker({
  running,
  startedAt,
  durationMs,
  className,
  prefix,
}: DurationTickerProps) {
  const elapsed = useElapsed(running, startedAt);
  const value = running ? elapsed : (durationMs ?? elapsed);
  return (
    <span className={cn("text-[11px] tabular-nums text-px-fg-subtle", className)}>
      {prefix ? `${prefix} ` : ""}
      {formatDuration(value)}
    </span>
  );
}
