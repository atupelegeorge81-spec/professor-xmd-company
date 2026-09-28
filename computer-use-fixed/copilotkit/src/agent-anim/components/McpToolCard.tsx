import { IconPlug } from "@tabler/icons-react";
import { ToolRow } from "../primitives/ToolRow";
import type { ToolCardBaseProps } from "../types";
import { isRunning } from "../types";

export type McpToolCardProps = ToolCardBaseProps & {
  /** MCP server name, e.g. "github". */
  server: string;
  /** Tool name, e.g. "create_issue". */
  tool: string;
  input?: unknown | undefined;
  output?: unknown | undefined;
};

function pretty(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** MCP call card: request JSON while running, response JSON when settled. */
export function McpToolCard({
  status,
  server,
  tool,
  input,
  output,
  durationMs,
  startedAt,
  className,
  defaultExpanded,
}: McpToolCardProps) {
  const running = isRunning(status);
  return (
    <ToolRow
      status={status}
      icon={<IconPlug size={13} />}
      activeLabel={`Calling ${server}`}
      label={`Called ${server}`}
      detail={<code className="font-mono text-[12px]">{tool}</code>}
      trailing={
        <span className="rounded-full bg-px-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-px-accent">
          MCP
        </span>
      }
      durationMs={durationMs}
      startedAt={startedAt}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="flex flex-col gap-2">
        <Section title="Request" body={pretty(input)} />
        {!running && output !== undefined && <Section title="Response" body={pretty(output)} />}
      </div>
    </ToolRow>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-px-fg-subtle">
        {title}
      </p>
      <pre className="max-h-40 overflow-auto rounded-px bg-px-code-bg px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-px-code-fg">
        {body}
      </pre>
    </div>
  );
}
