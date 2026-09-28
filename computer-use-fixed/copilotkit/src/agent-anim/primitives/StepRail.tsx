import { cn } from "../lib/cn";
import type { ToolStatus } from "../types";
import { StatusIcon } from "./StatusIcon";

export type StepRailProps = {
  status: ToolStatus;
  /** Hide the connector below the last item. */
  last?: boolean | undefined;
  className?: string | undefined;
};

/**
 * Vertical timeline rail: status node plus the connecting line.
 * The line animates from dashed (running) to solid (settled).
 */
export function StepRail({ status, last = false, className }: StepRailProps) {
  const running = status === "running" || status === "pending";
  return (
    <div className={cn("flex w-4 shrink-0 flex-col items-center", className)} aria-hidden>
      <StatusIcon status={status} size={12} />
      {!last && (
        <span
          className={cn(
            "mt-1 w-px flex-1",
            running ? "bg-transparent" : "bg-px-border",
          )}
          style={
            running
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(180deg, var(--px-border-strong) 0 3px, transparent 3px 7px)",
                  backgroundSize: "1px 7px",
                  animation: "px-scan 1.2s linear infinite",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
