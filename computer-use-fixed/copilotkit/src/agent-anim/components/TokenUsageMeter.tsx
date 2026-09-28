import { IconCoin } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { CountUp } from "../primitives/CountUp";
import { ProgressBar } from "../primitives/ProgressBar";

export type TokenUsageMeterProps = {
  used: number;
  /** Context window size. */
  limit: number;
  className?: string | undefined;
  label?: string | undefined;
};

/** Context-window meter: the number ramps up and the bar recolours near the cap. */
export function TokenUsageMeter({ used, limit, className, label = "Context" }: TokenUsageMeterProps) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const tone = ratio > 0.9 ? "danger" : ratio > 0.7 ? "warning" : "accent";

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-px-fg-muted">
        <IconCoin size={12} />
        <span>{label}</span>
        <span className="ml-auto tabular-nums">
          <CountUp value={used} compact /> / {(limit / 1000).toFixed(0)}k tokens
        </span>
      </div>
      <ProgressBar value={ratio} tone={tone} label="Context usage" />
    </div>
  );
}
