import type { Agent } from "@/lib/agents";
import { Avatar } from "./Avatar";

interface Props {
  agents: Agent[];
  activeId: string;
  onSelect: (id: string) => void;
  onReset: () => void;
  busy: boolean;
}

export function AgentSidebar({ agents, activeId, onSelect, onReset, busy }: Props) {
  return (
    <aside className="glass-strong flex h-full w-[300px] shrink-0 flex-col rounded-r-3xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-display text-[14px] font-bold text-foreground">TEAM CHANNELS</p>
          <p className="text-[10.5px] text-muted-foreground">Five specialist agents</p>
        </div>
        <button onClick={onReset} disabled={busy} className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[10.5px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40">
          New
        </button>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {agents.map((a) => {
          const active = a.id === activeId;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              disabled={busy}
              className={`panel-hover mb-1.5 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${active ? "border-primary/45 bg-secondary/70" : "border-transparent bg-secondary/25"}`}
            >
              <Avatar agent={a} size={38} live={active && busy} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[13.5px] font-semibold text-foreground">{a.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{a.role}</span>
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.accent }} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
