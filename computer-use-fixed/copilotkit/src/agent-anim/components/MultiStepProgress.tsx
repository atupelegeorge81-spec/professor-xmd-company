import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { ShimmerText } from "../primitives/ShimmerText";

export type MultiStepProgressProps = {
  /** Step labels in order. */
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string | undefined;
};

/** Horizontal step meter: segments fill as the agent advances. */
export function MultiStepProgress({ steps, current, className }: MultiStepProgressProps) {
  const label = steps[Math.min(current, steps.length - 1)] ?? "";
  const complete = current >= steps.length;

  return (
    <div className={cn("w-full", className)} role="group" aria-label="Task progress">
      <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
        <span className="font-medium">
          <ShimmerText active={!complete}>{complete ? "All steps complete" : label}</ShimmerText>
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-px-fg-subtle">
          {Math.min(current + (complete ? 0 : 1), steps.length)}/{steps.length}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((step, index) => (
          <span key={step} className="h-1 flex-1 overflow-hidden rounded-full bg-px-surface-2">
            <motion.span
              className={cn(
                "block h-full rounded-full",
                index < current ? "bg-px-success" : "bg-px-accent",
              )}
              initial={{ width: 0 }}
              animate={{ width: index < current ? "100%" : index === current ? "55%" : "0%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
