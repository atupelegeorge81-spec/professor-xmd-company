import { useState } from "react";
import { getAgent } from "@/lib/agents";
import type { LogEntry } from "@/lib/types";
import { Avatar } from "./Avatar";

interface UsageData {
  [k: string]: { requests: number; tokens: number } | undefined;
}

interface Props {
  logs: LogEntry[];
  roomLabel: string;
  usage?: UsageData | null;
  onClear: () => void;
}

const ICON: Record<string, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  api: "⚡",
  search: "🔍",
  system: "⚙️",
  info: "ℹ️",
};
const COLOR: Record<string, string> = {
  success: "text-[oklch(0.76_0.16_155)]",
  error: "text-destructive",
  warning: "text-warning",
  api: "text-primary",
  search: "text-accent",
  system: "text-muted-foreground",
  info: "text-muted-foreground",
};

export function LogsPopup({ logs, roomLabel, usage, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [convCopied, setConvCopied] = useState(false);

  const copy = () =>
    navigator.clipboard.writeText(logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join("\n"));

  /** Full active-room conversation (no thought process). Set by BoardRoom / AgentChat. */
  const copyConversation = async () => {
    try {
      const fn = (window as unknown as { __xmdExportConversation?: () => string }).__xmdExportConversation;
      const text = typeof fn === "function" ? fn() : "";
      if (!text || !text.trim()) {
        return;
      }
      await navigator.clipboard.writeText(text);
      setConvCopied(true);
      window.setTimeout(() => setConvCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const usageEntries = usage
    ? (Object.entries(usage).filter(([k, v]) => k !== "total" && v) as [string, { requests: number; tokens: number }][])
    : [];
  const total = usage?.["total"];

  return (
    <>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="glass-strong fixed bottom-24 right-3 z-40 flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-semibold text-foreground transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        Logs
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{logs.length}</span>
      </button>

      {isOpen && (
        <div className="sheet-up glass-strong fixed inset-x-2 bottom-36 z-40 mx-auto max-h-[60vh] max-w-3xl overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-display text-[12.5px] font-bold text-foreground">System logs</span>
              <span className="truncate rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{roomLabel}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={copyConversation}
                title={convCopied ? "Conversation copied" : "Copy full conversation (no thinking)"}
                aria-label="Copy full conversation"
                className="grid h-7 w-7 place-items-center rounded-lg bg-secondary/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              {convCopied && (
                <span className="text-[9px] text-muted-foreground">Copied</span>
              )}
              <button onClick={copy} className="rounded-lg bg-secondary/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:text-foreground">
                Copy
              </button>
              <button onClick={onClear} className="rounded-lg bg-destructive/15 px-2 py-1 text-[10px] text-destructive transition hover:bg-destructive/25">
                Clear
              </button>
              <button onClick={() => setIsOpen(false)} className="rounded-lg bg-secondary/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:text-foreground">
                ✕
              </button>
            </div>
          </div>

          {usageEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 border-b border-border bg-secondary/20 px-4 py-2 sm:grid-cols-3">
              {usageEntries.map(([id, u]) => {
                const a = getAgent(id);
                return (
                  <div key={id} className="flex items-center gap-2 rounded-xl bg-background/40 px-2 py-1.5">
                    <Avatar agent={a} size={22} />
                    <span className="min-w-0">
                      <span className="block truncate text-[10.5px] font-semibold text-foreground">{a?.name || id}</span>
                      <span className="block text-[9.5px] text-muted-foreground">
                        {u.requests} req · {(u.tokens / 1000).toFixed(1)}k tok
                      </span>
                    </span>
                  </div>
                );
              })}
              {total && (
                <div className="col-span-2 rounded-xl bg-primary/10 px-2 py-1.5 sm:col-span-3">
                  <span className="text-[10.5px] font-semibold text-primary">
                    TOTAL: {total.requests} requests · {(total.tokens / 1000).toFixed(1)}k tokens
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="scroll-thin max-h-[42vh] overflow-y-auto px-4 py-2">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-[11.5px] text-muted-foreground">No activity yet.</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="flex gap-2 border-b border-border/60 py-1 font-mono text-[10.5px] leading-4">
                  <span className="shrink-0 text-muted-foreground/70">{l.timestamp}</span>
                  <span className="shrink-0">{ICON[l.type] || "ℹ️"}</span>
                  <span className={COLOR[l.type] || "text-muted-foreground"}>{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
