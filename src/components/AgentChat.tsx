"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/lib/agents";
import type { LogEntry, UiMessage } from "@/lib/types";
import { Avatar } from "./Avatar";
import { AssistantAgentRuntime } from "./AssistantAgentRuntime";
import { AssistantAgentThread } from "./AssistantAgentThread";

interface Props {
  agent: Agent;
  addLog: (type: LogEntry["type"], message: string) => void;
  setUsage: (u: Record<string, { requests: number; tokens: number }>) => void;
}

export function AgentChat({ agent, addLog, setUsage }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Export full conversation text for Logs "copy conversation" button (no thinking).
  useEffect(() => {
    const exportConversation = () => {
      const lines: string[] = [];
      lines.push(`# ${agent.name} (${agent.role})`, "");
      for (const m of messages) {
        if (m.role === "user") {
          lines.push("You:", m.content || "", "");
          continue;
        }
        lines.push(`${agent.name}:`);
        if (m.query) lines.push(`Search: ${m.query}`);
        if (m.content) lines.push(m.content);
        if (m.sources?.length) {
          lines.push("Sources:");
          for (const s of m.sources) {
            lines.push(`- ${(s as { title?: string }).title || s.url} (${s.url})`);
          }
        }
        if (m.error) lines.push(`Error: ${m.error}`);
        lines.push("");
      }
      return lines.join("\n").trim();
    };

    (window as unknown as { __xmdExportConversation?: () => string }).__xmdExportConversation =
      exportConversation;

    return () => {
      const w = window as unknown as { __xmdExportConversation?: () => string };
      if (w.__xmdExportConversation === exportConversation) {
        delete w.__xmdExportConversation;
      }
    };
  }, [messages, agent]);

  useEffect(() => {
    try {
      const key = `xmd:conversation:${agent.id}`;
      const raw = window.localStorage.getItem(key);

      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          setMessages(saved);
        }
      }
    } catch {
    } finally {
      setHydrated(true);
    }
  }, [agent.id]);

  useEffect(() => {
    if (!hydrated) return;

    const key = `xmd:conversation:${agent.id}`;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(messages));
      } catch {
      }
    }, 400); // debounce — stops shake/jank on every thinking token

    return () => window.clearTimeout(t);
  }, [agent.id, messages, hydrated]);

  return (
    <AssistantAgentRuntime
      agent={agent}
      messages={messages}
      setMessages={setMessages}
      busy={busy}
      setBusy={setBusy}
      addLog={addLog}
      setUsage={setUsage}
    >
      <div
        data-agent={agent.id}
        className="xmd-agent-room flex min-h-0 flex-1 flex-col"
      >
        {messages.length === 0 && (
          <div className="xmd-agent-identity glass mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-3xl items-center gap-3.5 rounded-3xl px-4 py-3">
            <Avatar agent={agent} size={52} live={busy} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[16px] font-bold text-foreground">
                  {agent.name}
                </h2>

                <span
                  className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: `${agent.accent}22`,
                    color: agent.accent,
                  }}
                >
                  {agent.role}
                </span>
              </div>

              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {agent.tagline}
              </p>
            </div>

            <span className="hidden shrink-0 rounded-lg border border-border bg-background/50 px-2 py-1 font-mono text-[9.5px] text-muted-foreground sm:block">
              {agent.chip}
            </span>
          </div>
        )}

        <AssistantAgentThread
          agent={agent}
          busy={busy}
        />
      </div>
    </AssistantAgentRuntime>
  );
}
