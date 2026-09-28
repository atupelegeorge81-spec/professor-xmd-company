import { useEffect, useRef, useState, type FormEvent } from "react";
import { AgentAvatar, ShimmerText, Spinner } from "./agent-anim";
import {
  applyEvent,
  newAdapterState,
  type AdapterState,
} from "./openhands-to-timeline";
import { renderTimelineItem } from "./TimelineView";
import { ScreenshotModal } from "./ScreenshotModal";

const THREAD_KEY = "professor-xmd-thread-id";
function getThreadId() {
  const e = localStorage.getItem(THREAD_KEY);
  if (e) return e;
  const id = crypto.randomUUID();
  localStorage.setItem(THREAD_KEY, id);
  return id;
}

/**
 * True while the agent is "between" visible steps: the run is live, but
 * nothing on screen currently carries a "running" status. This is the gap
 * OpenHands gives us zero signal for (the model is composing its next
 * completion — reasoning_content + the next tool call only arrive once
 * that's finished), which is exactly the window SHIDA 3 complained about:
 * the ThinkingCard used to only appear *after* the thought was already
 * complete, so the actual thinking time was rendered as total silence.
 * This renders a lightweight, ephemeral "Agent is thinking" row for that
 * gap — not stored in the timeline, just derived UI state — so there is
 * always visible feedback the instant the agent starts working on the
 * next step, not only once it has something to show for it.
 */
function isAgentIdleThinking(isRunning: boolean, items: AdapterState["items"]): boolean {
  if (!isRunning) return false;
  const anyStepRunning = items.some(
    (item) =>
      (item.kind === "tool" || item.kind === "browser") && item.status === "running",
  );
  return !anyStepRunning;
}

export function Chat() {
  const [state, setState] = useState<AdapterState>(() => newAdapterState());
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [connection, setConnection] = useState<"idle" | "live" | "closed">("idle");
  const [modalImage, setModalImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const idleThinking = isAgentIdleThinking(isRunning, state.items);

  useEffect(() => {
    const source = new EventSource("/events");
    source.onopen = () => setConnection("live");
    source.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        let eventType = "";
        let data: any = {};

        if (event.type === "CUSTOM" && event.name === "OPENHANDS_EVENT") {
          const v = event.value || {};
          eventType = String(v.eventType || "");
          data = v.data || {};
        } else if (event.type === "RUN_STARTED") {
          eventType = "RUN_STARTED";
        } else if (event.type === "RUN_FINISHED") {
          setIsRunning(false);
          return;
        } else if (event.type === "RUN_ERROR") {
          setIsRunning(false);
          return;
        } else if (event.type === "TEXT_MESSAGE_CONTENT") {
          eventType = "TEXT_MESSAGE_CONTENT";
          data = event;
        }

        if (!eventType) return;

        setState((prev) => applyEvent(prev, eventType, data));

        if (eventType === "OpenHandsRunFinished" || eventType === "OpenHandsRunError") {
          setIsRunning(false);
        }
      } catch {}
    };
    source.onerror = () => setConnection("closed");
    return () => source.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.items, idleThinking]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const task = input.trim();
    if (!task || isRunning) return;
    setInput("");
    setIsRunning(true);

    setState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { kind: "user", id: "user-" + crypto.randomUUID(), text: task },
      ],
    }));

    const threadId = getThreadId();
    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          messages: [{ role: "user", content: task }],
        }),
      });
    } catch {
      setIsRunning(false);
    }
  }

  return (
    <div className="px-app-shell dark min-h-screen text-px-fg flex flex-col">
      <header className="sticky top-0 z-20 border-b border-px-border bg-px-bg/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <AgentAvatar size={24} state={isRunning ? "thinking" : "done"} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold tracking-tight">PROFESSOR-XMD</div>
            <div className="text-[11px] text-px-fg-muted">
              {isRunning ? "Agent running" : "Ready"} ·{" "}
              {connection === "live" ? "● connected" : connection === "closed" ? "● reconnecting" : "● waiting"}
            </div>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-5">
          {state.items.length === 0 && (
            <div className="text-center text-px-fg-muted text-[13px] py-12">
              Tell the agent what you want it to build.
            </div>
          )}
          {state.items.map((item) => renderTimelineItem(item, { onImageClick: setModalImage }))}

          {idleThinking && (
            <div
              className="flex items-center gap-2 rounded-px px-2 py-1.5 text-[13px]"
              aria-live="polite"
            >
              <Spinner />
              <ShimmerText>Agent is thinking</ShimmerText>
            </div>
          )}
        </div>
      </main>

      <form onSubmit={submit} className="border-t border-px-border bg-px-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRunning ? "Agent is working..." : "Type a message..."}
            disabled={isRunning}
            className="flex-1 rounded-px border border-px-border bg-px-surface px-3 py-2 text-[13px] outline-none transition-shadow focus:border-px-border-strong focus:ring-2 focus:ring-px-accent-soft disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isRunning || !input.trim()}
            className="rounded-px bg-px-accent px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isRunning ? "..." : "Send"}
          </button>
        </div>
      </form>
      <ScreenshotModal src={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
