import { useEffect, useRef, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { applyEvent, newAdapterState, type AdapterState } from "./openhands-to-timeline";
import { renderTimelineItem } from "./TimelineView";
import { SAMPLE_EVENTS } from "./sample-events";
import { ScreenshotModal } from "./ScreenshotModal";

const STEP_MS = 550;

/**
 * Replays sample-events/openhands-events.jsonl through the *real* adapter
 * (openhands-to-timeline.applyEvent) and the *real* renderer
 * (TimelineView.renderTimelineItem) — the exact same code path the live
 * Chat view uses — one event at a time, so every fix in this pass
 * (real-time tool rows, streaming reasoning reveal, the idle "thinking"
 * gap, timeout status, orphan MCP observations, and the finish/message
 * fix) can be seen working against real recorded data, not just isolated
 * component props.
 *
 * This is a validation tool, not a second implementation: if a bug is
 * fixed in openhands-to-timeline.ts or TimelineView.tsx, this demo picks
 * it up automatically because it imports the same functions Chat.tsx does.
 */
export function ReplaySample() {
  const [state, setState] = useState<AdapterState>(() => newAdapterState());
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing || cursor >= SAMPLE_EVENTS.length) return;
    const timer = window.setTimeout(() => {
      const raw = SAMPLE_EVENTS[cursor];
      let eventType = "";
      let data: any = {};
      if (raw.type === "CUSTOM" && raw.name === "OPENHANDS_EVENT") {
        eventType = String(raw.value?.eventType ?? "");
        data = raw.value?.data ?? {};
      } else if (raw.type === "RUN_STARTED") {
        eventType = "RUN_STARTED";
      } else if (raw.type === "RUN_FINISHED") {
        eventType = "OpenHandsRunFinished";
      } else if (raw.type === "TEXT_MESSAGE_CONTENT") {
        eventType = "TEXT_MESSAGE_CONTENT";
        data = raw;
      }
      if (eventType) {
        setState((prev) => applyEvent(prev, eventType, data));
      }
      setCursor((c) => c + 1);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, cursor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.items]);

  function replay() {
    setState(newAdapterState());
    setCursor(0);
    setPlaying(true);
  }

  const done = cursor >= SAMPLE_EVENTS.length;

  return (
    <div className="px-app-shell dark min-h-screen text-px-fg flex flex-col">
      <header className="sticky top-0 z-20 border-b border-px-border bg-px-bg/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold tracking-tight">Sample run replay</div>
            <div className="text-[11px] text-px-fg-muted">
              {done ? "Replay finished" : `Event ${Math.min(cursor + 1, SAMPLE_EVENTS.length)} / ${SAMPLE_EVENTS.length}`}
              {" · real recorded events, feeding the real adapter + renderer"}
            </div>
          </div>
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-1.5 rounded-full border border-px-border px-3 py-1 text-[12px] font-medium transition-colors hover:bg-px-surface"
          >
            <IconRefresh size={12} /> Replay
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-5">
          {state.items.length === 0 && (
            <div className="text-center text-px-fg-muted text-[13px] py-12">Starting replay…</div>
          )}
          {state.items.map((item) => renderTimelineItem(item, { onImageClick: setModalImage }))}
        </div>
      </main>
      <ScreenshotModal src={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
