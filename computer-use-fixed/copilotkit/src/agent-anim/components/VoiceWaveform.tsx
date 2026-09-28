import { motion } from "motion/react";
import { cn } from "../lib/cn";
import type { AgentState } from "../primitives/AgentAvatar";

export type VoiceWaveformProps = {
  /** listening / thinking / speaking drive the bar motion (LiveKit model). */
  state: AgentState;
  bars?: number | undefined;
  height?: number | undefined;
  className?: string | undefined;
};

/** Bouncing-bar audio visualiser for voice sessions. */
export function VoiceWaveform({ state, bars = 9, height = 22, className }: VoiceWaveformProps) {
  const active = state === "speaking" || state === "listening" || state === "thinking";
  const amplitude = state === "speaking" ? 1 : state === "listening" ? 0.55 : 0.3;

  return (
    <div
      className={cn("flex items-center gap-[3px]", className)}
      style={{ height }}
      role="img"
      aria-label={`Audio ${state}`}
    >
      {Array.from({ length: bars }).map((_, index) => {
        const center = 1 - Math.abs(index - (bars - 1) / 2) / bars;
        const peak = Math.max(0.18, center * amplitude);
        return (
          <motion.span
            key={index}
            className={cn(
              "w-[3px] rounded-full",
              state === "speaking" ? "bg-px-success" : "bg-px-accent",
            )}
            animate={
              active
                ? { height: [`${peak * 30}%`, `${peak * 100}%`, `${peak * 45}%`] }
                : { height: "18%" }
            }
            transition={{
              duration: 0.7 + index * 0.05,
              repeat: active ? Infinity : 0,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}
