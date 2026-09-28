import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { StepRail } from "../primitives/StepRail";
import { ShimmerText } from "../primitives/ShimmerText";
import type { ToolStatus } from "../types";
import { isRunning } from "../types";

export type ChainStep = {
  id: string;
  label: string;
  detail?: string | undefined;
  status: ToolStatus;
};

export type ChainOfThoughtProps = {
  steps: ChainStep[];
  className?: string | undefined;
};

/**
 * Numbered reasoning chain with a vertical rail — each step fades and slides
 * in as the agent reaches it, the rail animates while a step is running.
 */
export function ChainOfThought({ steps, className }: ChainOfThoughtProps) {
  return (
    <ol className={cn("w-full", className)}>
      {steps.map((step, index) => (
        <motion.li
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-8 gap-2.5"
        >
          <StepRail status={step.status} last={index === steps.length - 1} />
          <div className="pb-3 text-[13px] leading-5">
            <span className="font-medium">
              <ShimmerText active={isRunning(step.status)}>{step.label}</ShimmerText>
            </span>
            {step.detail && (
              <p className="mt-0.5 text-[12.5px] text-px-fg-muted">{step.detail}</p>
            )}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
