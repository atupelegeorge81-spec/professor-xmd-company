import { motion } from "motion/react";
import { IconArrowRight, IconRobot } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import { AgentAvatar } from "../primitives/AgentAvatar";
import { cn } from "../lib/cn";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type SubagentCardProps = ToolCardBaseProps & {
  /** Name of the sub-agent receiving the task. */
  name: string;
  task: string;
  /** Result summary once the sub-agent returns. */
  result?: string | undefined;
};

/**
 * Sub-agent handoff: the parent orb hands the task to a child orb, the arrow
 * travels while the sub-agent works, and the result folds in on return.
 */
export function SubagentCard({
  status,
  name,
  task,
  result,
  durationMs,
  startedAt,
  className,
  defaultExpanded = true,
}: SubagentCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconRobot size={13} />}
      activeLabel={`Delegating to ${name}`}
      label={`${name} finished`}
      detail={task}
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="rounded-px border border-px-border bg-px-bg p-2.5">
        <div className="flex items-center gap-2">
          <AgentAvatar size={18} state={running ? "thinking" : "done"} label="Parent agent" />
          <motion.span
            animate={running ? { x: [0, 6, 0], opacity: [0.4, 1, 0.4] } : { x: 0, opacity: 1 }}
            transition={{ duration: 1.2, repeat: running ? Infinity : 0, ease: "easeInOut" }}
            className="text-px-fg-subtle"
          >
            <IconArrowRight size={14} />
          </motion.span>
          <AgentAvatar size={18} state={running ? "speaking" : "done"} label={name} />
          <span className={cn("text-[12.5px] font-medium")}>{name}</span>
        </div>
        <p className="mt-2 text-[12.5px] text-px-fg-muted">{task}</p>
        {!running && result && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 border-l border-px-border pl-2.5 text-[12.5px]"
          >
            {result}
          </motion.p>
        )}
      </div>
    </ToolRow>
  );
}
