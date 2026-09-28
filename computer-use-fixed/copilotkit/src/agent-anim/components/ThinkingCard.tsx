import { useEffect, useState } from "react";
import { IconBrain } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { StreamingCaret } from "../primitives/StreamingCaret";
import { useTypewriter } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type ThinkingCardProps = ToolCardBaseProps & {
  /** Reasoning text; revealed when expanded. */
  thought?: string | undefined;
  /** Label while reasoning. */
  activeLabel?: string | undefined;
  /** Characters per second for the live-reveal animation. */
  revealSpeed?: number | undefined;
};

/**
 * "Thinking" (shimmer) -> "Thought for 12.4s" (static, collapsed).
 * Matches the Claude Code CLI pattern of collapsing reasoning into a
 * single summary line once it finishes.
 *
 * OpenHands only ever hands us `reasoning_content` as one complete string
 * the instant the ActionEvent lands — there is no token-by-token signal
 * to relay, so a literal "live" stream isn't available from this data
 * source. What every reasoning-capable product does when it receives text
 * in bigger chunks over SSE (ChatGPT, Claude.ai, Perplexity) is reveal it
 * client-side at reading speed instead of dumping the whole paragraph in
 * one frame — that's what makes a completed chunk still *feel* live. This
 * component now does the same: the moment new `thought` text mounts, it
 * types itself out with a blinking caret, then settles into the normal
 * static summary line. The outer shape/markup is unchanged.
 */
export function ThinkingCard({
  status,
  thought,
  activeLabel = "Thinking",
  revealSpeed = 70,
  durationMs,
  startedAt,
  className,
  defaultExpanded,
  onToggle,
}: ThinkingCardProps) {
  const [revealing, setRevealing] = useState(Boolean(thought));

  useEffect(() => {
    if (!thought) {
      setRevealing(false);
      return;
    }
    setRevealing(true);
    const revealMs = Math.min(5000, Math.max(280, (thought.length / revealSpeed) * 1000 + 200));
    const timer = window.setTimeout(() => setRevealing(false), revealMs);
    return () => window.clearTimeout(timer);
    // Re-run only when the thought text itself changes — a new reasoning
    // chunk should always get its own reveal pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought]);

  const shown = useTypewriter(thought ?? "", revealing, revealSpeed);
  const effectiveStatus = revealing ? "running" : status;
  const running = isRunning(effectiveStatus);

  return (
    <ToolRow
      status={effectiveStatus}
      icon={<IconBrain size={13} />}
      activeLabel={activeLabel}
      label={durationMs ? `Thought for ${formatDuration(durationMs)}` : "Thought"}
      showDuration={running}
      startedAt={startedAt}
      durationMs={durationMs}
      className={className}
      defaultExpanded={defaultExpanded}
      autoCollapseOnComplete={defaultExpanded === undefined}
      onToggle={onToggle}
    >
      {thought && (
        <p className="whitespace-pre-wrap border-l border-px-border pl-3 text-[12.5px] leading-relaxed text-px-fg-muted">
          {revealing ? shown : thought}
          {revealing && <StreamingCaret className="text-px-accent" />}
        </p>
      )}
    </ToolRow>
  );
}
