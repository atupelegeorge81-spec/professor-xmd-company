import type { ElementType, ReactNode } from "react";
import { cn } from "../lib/cn";

export type ShimmerTextProps = {
  children: ReactNode;
  /** Render element, defaults to `span`. */
  as?: ElementType | undefined;
  /** Sweep duration in seconds. */
  duration?: number | undefined;
  /** Set false to render plain text (completed state). */
  active?: boolean | undefined;
  className?: string | undefined;
};

/**
 * Sweeping-gradient label used for every "ongoing" verb
 * ("Thinking", "Running command", "Reading file").
 */
export function ShimmerText({
  children,
  as: Component = "span",
  duration = 1.6,
  active = true,
  className,
}: ShimmerTextProps) {
  if (!active) {
    return <Component className={cn("text-px-fg", className)}>{children}</Component>;
  }
  return (
    <Component
      className={cn("px-shimmer-text", className)}
      style={{ ["--px-shimmer-duration" as string]: `${duration}s` }}
    >
      {children}
    </Component>
  );
}
