import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { cleanTerminalOutput } from "../lib/ansi";
import { StreamingCaret } from "../primitives/StreamingCaret";
import { useStaggeredReveal } from "../lib/hooks";

export type TerminalStreamProps = {
  /** Raw lines as they arrive; ANSI is stripped per line. */
  lines: string[];
  /** While true a caret blinks on the last line and new lines stagger in. */
  streaming?: boolean | undefined;
  /** Delay between revealed lines in ms. */
  every?: number | undefined;
  maxHeight?: number | undefined;
  className?: string | undefined;
};

/** Live terminal log: lines slide in one by one and the view auto-scrolls. */
export function TerminalStream({
  lines,
  streaming = true,
  every = 140,
  maxHeight = 220,
  className,
}: TerminalStreamProps) {
  const shown = useStaggeredReveal(lines, streaming, every);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [shown.length]);

  return (
    <div
      ref={ref}
      className={cn("overflow-auto rounded-px bg-px-code-bg px-3 py-2", className)}
      style={{ maxHeight }}
      aria-live="polite"
    >
      {shown.map((line, index) => (
        <motion.div
          key={`${index}-${line}`}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16 }}
          className="whitespace-pre-wrap font-mono text-[11.5px] leading-[1.55] text-px-code-fg"
        >
          {cleanTerminalOutput(line) || "\u00a0"}
          {streaming && index === shown.length - 1 && (
            <StreamingCaret block className="text-px-success" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
