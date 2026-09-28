import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { IconSparkles } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { ShimmerText } from "../primitives/ShimmerText";
import { StreamingCaret } from "../primitives/StreamingCaret";
import { CollapsibleSection } from "../primitives/CollapsibleSection";
import { DurationTicker } from "../primitives/DurationTicker";
import { useTypewriter } from "../lib/hooks";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type ReasoningStreamProps = ToolCardBaseProps & {
  /** Full reasoning text. Typed out live while running. */
  text: string;
  /** Characters per second while streaming. */
  speed?: number | undefined;
};

/**
 * Reasoning panel that auto-opens while the model streams and auto-closes
 * when the stream finishes (AI Elements `Reasoning` behaviour), with a
 * blinking caret on the live text.
 */
export function ReasoningStream({
  status,
  text,
  speed = 55,
  durationMs,
  startedAt,
  className,
}: ReasoningStreamProps) {
  const running = isRunning(status);
  const shown = useTypewriter(text, running, speed);
  const [open, setOpen] = useState(running);

  useEffect(() => {
    setOpen(running);
  }, [running]);

  return (
    <div className={cn("w-full rounded-px border border-px-border bg-px-surface p-2.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-[13px] font-medium"
      >
        <IconSparkles size={13} className="text-px-accent" />
        <ShimmerText active={running}>{running ? "Reasoning" : "Reasoned"}</ShimmerText>
        <span className="ml-auto">
          <DurationTicker running={running} startedAt={startedAt} durationMs={durationMs} />
        </span>
      </button>

      <CollapsibleSection open={open}>
        <motion.p
          layout
          className="mt-2 whitespace-pre-wrap border-l border-px-border pl-3 text-[12.5px] leading-relaxed text-px-fg-muted"
        >
          {running ? shown : text}
          {running && <StreamingCaret className="text-px-accent" />}
        </motion.p>
      </CollapsibleSection>
    </div>
  );
}
