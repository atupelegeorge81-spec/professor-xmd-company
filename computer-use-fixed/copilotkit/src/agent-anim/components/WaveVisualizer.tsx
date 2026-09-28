import { motion } from "motion/react";
import { cn } from "../lib/cn";
import type { AgentState } from "../primitives/AgentAvatar";

export type WaveVisualizerProps = {
  state: AgentState;
  className?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

/** Inline SVG sine wave whose amplitude tracks the agent state. */
export function WaveVisualizer({ state, className, width = 220, height = 40 }: WaveVisualizerProps) {
  const amplitude = state === "speaking" ? 12 : state === "listening" ? 7 : state === "thinking" ? 4 : 1.5;
  const mid = height / 2;
  const path = (phase: number) => {
    const points: string[] = [];
    for (let x = 0; x <= width; x += 8) {
      const y = mid + Math.sin(x / 22 + phase) * amplitude * Math.sin((x / width) * Math.PI);
      points.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(2)}`);
    }
    return points.join(" ");
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Waveform ${state}`}
    >
      <motion.path
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        className={state === "speaking" ? "stroke-px-success" : "stroke-px-accent"}
        animate={{ d: [path(0), path(Math.PI), path(2 * Math.PI)] }}
        transition={{ duration: 1.8, repeat: state === "idle" ? 0 : Infinity, ease: "linear" }}
      />
    </svg>
  );
}
