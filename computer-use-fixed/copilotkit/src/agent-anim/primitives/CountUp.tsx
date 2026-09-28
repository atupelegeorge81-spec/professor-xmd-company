import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { formatCount } from "../lib/format";

export type CountUpProps = {
  value: number;
  /** Ramp duration in ms. */
  durationMs?: number | undefined;
  className?: string | undefined;
  /** Format large numbers as 1.2k / 3.4M. */
  compact?: boolean | undefined;
};

/** Animates a number from its previous value to the new one (token counters). */
export function CountUp({ value, durationMs = 600, className, compact = false }: CountUpProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = display;
    const delta = value - from;
    if (delta === 0) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return (
    <span className={cn("tabular-nums", className)}>
      {compact ? formatCount(display) : display.toLocaleString()}
    </span>
  );
}
