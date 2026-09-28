import type { ReactNode } from "react";
import { IconTool } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import type { ToolCardBaseProps } from "../types";

export type GenericToolCardProps = ToolCardBaseProps & {
  /** Raw tool name from the event stream. */
  name: string;
  /** Present-tense label; defaults to `Running <name>`. */
  activeLabel?: string | undefined;
  /** Past-tense label; defaults to `Ran <name>`. */
  label?: string | undefined;
  detail?: string | undefined;
  icon?: ReactNode | undefined;
  children?: ReactNode | undefined;
};

/** Fallback card for any tool without a dedicated renderer. */
export function GenericToolCard({
  status,
  name,
  activeLabel,
  label,
  detail,
  icon,
  children,
  durationMs,
  startedAt,
  className,
  defaultExpanded,
}: GenericToolCardProps) {
  return (
    <ToolRow
      status={status}
      icon={icon ?? <IconTool size={13} />}
      activeLabel={activeLabel ?? `Running ${name}`}
      label={label ?? `Ran ${name}`}
      detail={detail}
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      {children}
    </ToolRow>
  );
}
