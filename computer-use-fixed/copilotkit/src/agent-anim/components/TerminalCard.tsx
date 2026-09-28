import { IconTerminal2 } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { cn } from "../lib/cn";
import { toTerminalLines } from "../lib/ansi";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type TerminalCardProps = ToolCardBaseProps & {
  command: string;
  /** Raw observation text — ANSI escapes are stripped before rendering. */
  output?: string | undefined;
  exitCode?: number | undefined;
  /** Max visible lines before the panel scrolls. */
  maxLines?: number | undefined;
};

/**
 * "Running command" -> "Ran command" with a dark output panel.
 * Output is passed through the ANSI cleaner so `[?2004l` / `[01;34m`
 * sequences from OpenHands terminal observations never reach the DOM.
 */
export function TerminalCard({
  status,
  command,
  output,
  exitCode,
  maxLines = 14,
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
  onToggle,
}: TerminalCardProps) {
  const running = isRunning(status);
  const lines = output ? toTerminalLines(output) : [];

  return (
    <ToolRow
      status={status}
      icon={<IconTerminal2 size={13} />}
      activeLabel="Running command"
      label="Ran command"
      detail={<code className="font-mono text-[12px]">{command}</code>}
      trailing={
        !running ? (
          status === "timeout" ? (
            <span className="rounded-full bg-px-timeout-soft px-1.5 py-0.5 text-[10.5px] font-medium text-px-timeout">
              timed out
            </span>
          ) : exitCode !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums",
                exitCode === 0
                  ? "bg-px-success-soft text-px-success"
                  : "bg-px-danger-soft text-px-danger",
              )}
            >
              exit {exitCode}
            </span>
          ) : null
        ) : null
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
      onToggle={onToggle}
    >
      <div className="overflow-hidden rounded-px bg-px-code-bg">
        <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-1.5">
          <span className="size-2 rounded-full bg-px-danger/70" />
          <span className="size-2 rounded-full bg-px-warning/70" />
          <span className="size-2 rounded-full bg-px-success/70" />
          <span className="ml-2 truncate font-mono text-[11px] text-px-code-fg/60">bash</span>
        </div>
        <pre
          className="overflow-auto px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-px-code-fg"
          style={{ maxHeight: `${maxLines * 1.5}em` }}
        >
          <span className="text-px-success">$ </span>
          {command}
          {lines.length > 0 && `\n${lines.join("\n")}`}
        </pre>
      </div>
    </ToolRow>
  );
}
