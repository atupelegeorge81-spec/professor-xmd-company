import type { Agent } from "@/lib/agents";
import type { UiMessage } from "@/lib/types";
import { Markdown } from "./Markdown";
import { Avatar } from "./Avatar";

export function MessageBubble({ message, agent }: { message: UiMessage; agent?: Agent }) {
  const isUser = message.role === "user";
  const live = message.phase !== "done" && message.phase !== "error";

  if (isUser) {
    return (
      <div className="rise-in flex justify-end">
        <div className="max-w-[86%] rounded-2xl rounded-br-md bg-primary/70 px-4 py-2.5 text-[14px] leading-6 text-primary-foreground shadow-[0_10px_30px_-14px_var(--primary)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in flex gap-3">
      <Avatar agent={agent} size={38} live={live} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[14px] font-semibold text-foreground">{agent?.name}</span>
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {agent?.role}
          </span>
          {live && (
            <span
              className="xmd-thinking-sweep text-[11px] font-medium"
              style={{ "--think-color": agent?.accent } as React.CSSProperties} data-text={message.phase === "searching" ? "searching the web…" : message.phase === "answering" ? "writing…" : "thinking…"}
            >
              {message.phase === "searching" ? "searching the web…" : message.phase === "answering" ? "writing…" : "thinking…"}
            </span>
          )}
        </div>

        {message.thinking && (
          <details className="group overflow-hidden rounded-xl border border-border bg-background/40">
            <summary className="cursor-pointer select-none px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground">
              ✦ Thought process
            </summary>
            <div className="scroll-thin max-h-56 overflow-y-auto whitespace-pre-wrap border-t border-border px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {message.thinking}
            </div>
          </details>
        )}

        {message.query && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {message.query}
          </div>
        )}

        {message.searchError && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] text-warning">
            ⚠️ {message.searchError}
          </div>
        )}

        {message.sources?.length > 0 && (
          <div className="grid gap-1">
            {message.sources.slice(0, 4).map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="truncate rounded-lg border border-border bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                🔗 {s.title || s.url}
              </a>
            ))}
          </div>
        )}

        {message.content && (
          <div
            className="glass rounded-2xl rounded-tl-md px-3.5 py-2.5"
            style={{ borderLeft: `2px solid ${agent?.accent ?? "var(--primary)"}` }}
          >
            <Markdown text={message.content} />
            {live && <span className="caret" />}
          </div>
        )}

        {message.phase === "error" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive-foreground">
            ❌ {message.error}
          </div>
        )}
      </div>
    </div>
  );
}
