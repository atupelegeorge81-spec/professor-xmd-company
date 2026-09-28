import { motion } from "motion/react";
import { cn } from "../lib/cn";

export type AgentState = "idle" | "listening" | "thinking" | "speaking" | "done";

export type AgentAvatarProps = {
  /** Mirrors the LiveKit agent-state model (listening / thinking / speaking). */
  state?: AgentState | undefined;
  size?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
};

const STATE_RING: Record<AgentState, string> = {
  idle: "shadow-[0_0_0_1px_var(--px-border)]",
  listening: "shadow-[0_0_0_1px_var(--px-accent),0_0_18px_var(--px-accent-soft)]",
  thinking: "shadow-[0_0_0_1px_var(--px-accent),0_0_22px_var(--px-accent-soft)]",
  speaking: "shadow-[0_0_0_1px_var(--px-success),0_0_22px_var(--px-success-soft)]",
  done: "shadow-[0_0_0_1px_var(--px-success)]",
};

/**
 * Breathing gradient orb that represents the agent itself.
 * Rotates while thinking, pulses while speaking, still when idle.
 */
export function AgentAvatar({ state = "idle", size = 28, className, label = "Agent" }: AgentAvatarProps) {
  const animate =
    state === "thinking"
      ? { scale: [1, 1.06, 1], rotate: [0, 180, 360] }
      : state === "speaking"
        ? { scale: [1, 1.12, 1], rotate: 0 }
        : state === "listening"
          ? { scale: [1, 1.04, 1], rotate: 0 }
          : { scale: 1, rotate: 0 };

  return (
    <motion.span
      role="img"
      aria-label={`${label}: ${state}`}
      className={cn("inline-block shrink-0 rounded-full", STATE_RING[state], className)}
      style={{
        width: size,
        height: size,
        backgroundImage:
          "conic-gradient(from 210deg, var(--px-accent), color-mix(in oklab, var(--px-accent) 40%, transparent), var(--px-accent))",
      }}
      animate={animate}
      transition={{
        duration: state === "speaking" ? 0.9 : 2.4,
        repeat: state === "idle" || state === "done" ? 0 : Infinity,
        ease: "easeInOut",
      }}
    />
  );
}
