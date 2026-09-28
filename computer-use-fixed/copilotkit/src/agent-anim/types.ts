import type { ReactNode } from "react";

/**
 * Lifecycle of a single agent step. Mirrors the AI SDK tool-part states.
 * `timeout` is distinct from `error`: the command/tool did not fail, it
 * simply exceeded its allotted time (OpenHands terminal observations carry
 * a dedicated `timeout: boolean` field for this — see openhands-to-timeline.ts).
 */
export type ToolStatus = "pending" | "running" | "success" | "error" | "cancelled" | "timeout";

/** Everything a tool card needs to draw its ongoing -> completed transition. */
export type ToolCardBaseProps = {
  status: ToolStatus;
  /** Milliseconds the step took; when omitted a live ticker is used. */
  durationMs?: number | undefined;
  /** Epoch ms the step started — drives the live ticker. */
  startedAt?: number | undefined;
  className?: string | undefined;
  defaultExpanded?: boolean | undefined;
  onToggle?: ((expanded: boolean) => void) | undefined;
};

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger" | "timeout";

export type TimelineStepKind =
  | "thinking"
  | "terminal"
  | "read"
  | "write"
  | "edit"
  | "search"
  | "browse"
  | "screenshot"
  | "mcp"
  | "plan"
  | "subagent"
  | "generic";

export type TimelineStep = {
  id: string;
  kind: TimelineStepKind;
  label: string;
  detail?: string | undefined;
  status: ToolStatus;
  durationMs?: number | undefined;
  content?: ReactNode | undefined;
};

export const STATUS_TONE: Record<ToolStatus, StatusTone> = {
  pending: "neutral",
  running: "accent",
  success: "success",
  error: "danger",
  cancelled: "warning",
  timeout: "timeout",
};

export function isRunning(status: ToolStatus): boolean {
  return status === "running" || status === "pending";
}
