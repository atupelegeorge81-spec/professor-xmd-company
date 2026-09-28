import type { ToolStatus } from "./agent-anim/types";

export type TimelineItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "thinking"; id: string; thought: string }
  | { kind: "assistant-text"; id: string; text: string; streaming: boolean }
  | { kind: "tool"; id: string; toolCallId: string; toolName: string; action: any; observation?: any; status: ToolStatus; startedAt: number; durationMs?: number }
  | { kind: "boot"; id: string; label: string; current: number }
  | { kind: "complete"; id: string; chips: string[]; totalMs: number }
  | { kind: "error"; id: string; message: string }
  | { kind: "toast"; id: string; title: string; tone: "info" | "success" | "error" }
  | { kind: "preview"; id: string; port: number }
  | {
      kind: "browser";
      id: string;
      toolCallId: string;
      toolName: string;
      action: any;
      observation?: any;
      status: ToolStatus;
      startedAt: number;
      durationMs?: number;
    };

export type AdapterState = {
  items: TimelineItem[];
  activeToolIndex: Map<string, number>;
  assistantTextId: string | null;
  runStartedAt: number | null;
};

export function newAdapterState(): AdapterState {
  return {
    items: [],
    activeToolIndex: new Map(),
    assistantTextId: null,
    runStartedAt: null,
  };
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b: any) => (b?.text ? String(b.text) : "")).filter(Boolean).join("\n");
}

function detectPort(cmd: string): number | null {
  const c = String(cmd || "");
  let m = c.match(/http\.server\s+(\d+)/);
  if (m) return Number(m[1]);
  m = c.match(/--port[=\s]+(\d+)/);
  if (m) return Number(m[1]);
  m = c.match(/:(\d{2,5})\b/);
  if (m) return Number(m[1]);
  if (/npm\s+run\s+dev|next\s+dev/.test(c)) return 3000;
  if (/\bvite\b/.test(c)) return 5173;
  return null;
}

function cleanAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\[\?2004[hl]/g, "");
}

/**
 * OpenHands terminal (and some other) observations carry a dedicated
 * `timeout: boolean` field distinct from `is_error` — a command that ran
 * out of time did not necessarily fail, it just didn't finish. Previously
 * this was collapsed into a plain success/error, which meant a hung
 * command silently rendered a green checkmark once its wall-clock limit
 * was hit. Error still wins if both are somehow set.
 */
function resolveSettledStatus(observation: any): ToolStatus {
  if (observation?.is_error === true) return "error";
  if (observation?.timeout === true) return "timeout";
  return "success";
}

function toolLabel(toolName: string, action: any): { active: string; done: string; detail: string } {
  if (toolName === "terminal") {
    const cmd = String(action?.command ?? "").slice(0, 60);
    return { active: "Running command", done: "Ran command", detail: cmd };
  }
  if (toolName === "file_editor") {
    const cmd = String(action?.command ?? "");
    const p = String(action?.path ?? "").split("/").pop() ?? "";
    if (cmd === "create") return { active: "Creating file", done: "Created file", detail: p };
    if (cmd === "view") return { active: "Reading file", done: "Read file", detail: p };
    if (cmd === "str_replace" || cmd === "insert")
      return { active: "Editing file", done: "Edited file", detail: p };
    return { active: "Editing", done: "Edited", detail: p };
  }
  if (toolName === "think") return { active: "Thinking", done: "Thought", detail: "" };
  if (toolName === "finish") return { active: "Finishing", done: "Finished", detail: "" };
  if (toolName === "glob" || toolName === "grep")
    return { active: "Searching", done: "Searched", detail: String(action?.pattern ?? "") };
  return { active: `Running ${toolName}`, done: `Ran ${toolName}`, detail: "" };
}

export function applyEvent(
  state: AdapterState,
  eventType: string,
  data: any,
): AdapterState {
  const items = [...state.items];
  const activeToolIndex = new Map(state.activeToolIndex);
  let assistantTextId = state.assistantTextId;
  let runStartedAt = state.runStartedAt;

  // ---------- RUN_STARTED ----------
  if (eventType === "RUN_STARTED") {
    runStartedAt = Date.now();
    items.push({
      kind: "boot",
      id: "boot-" + Date.now(),
      label: "Creating sandbox",
      current: 0,
    });
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  // ---------- TEXT_MESSAGE (system boot feedback) ----------
  if (eventType === "TEXT_MESSAGE_CONTENT") {
    const delta = String(data?.delta ?? "");
    if (delta) {
      // Update boot label if system message
      const bootIdx = items.findIndex((i) => i.kind === "boot");
      if (bootIdx >= 0) {
        const phase = delta.includes("Sandbox")
          ? 2
          : delta.includes("Starting OpenHands")
            ? 3
            : 1;
        items[bootIdx] = {
          kind: "boot",
          id: items[bootIdx].id,
          label: "Preparing agent",
          current: phase,
        };
      }
    }
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  // ---------- OpenHands internal events ----------
  if (eventType === "MessageEvent") {
    const llm = data?.llm_message;
    const role = llm?.role;
    if (role === "assistant") {
      const text = extractText(llm?.content);
      if (text.trim()) {
        if (assistantTextId) {
          const idx = items.findIndex((i) => i.id === assistantTextId);
          if (idx >= 0) {
            items[idx] = {
              kind: "assistant-text",
              id: assistantTextId,
              text: (items[idx] as any).text + "\n" + text,
              streaming: false,
            };
            return { items, activeToolIndex, assistantTextId, runStartedAt };
          }
        }
        const id = "asst-" + Date.now();
        assistantTextId = id;
        items.push({ kind: "assistant-text", id, text, streaming: false });
      }
    }
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  if (eventType === "ActionEvent") {
    const toolName = String(data?.tool_name ?? "unknown");
    const action = data?.action ?? {};
    const toolCallId = String(data?.tool_call_id ?? data?.id ?? "");
    if (!toolCallId) return { items, activeToolIndex, assistantTextId, runStartedAt };

    // Remove boot card once agent starts working
    const bootIdx = items.findIndex((i) => i.kind === "boot");
    if (bootIdx >= 0) items.splice(bootIdx, 1);

    // OpenHands' `thought` field is an array of {type:"text"} blocks the
    // model produces as a *visible* aside alongside the tool call — not to
    // be confused with `reasoning_content` (private chain-of-thought,
    // rendered in the collapsible ThinkingCard below). This was previously
    // read nowhere at all, which made the agent look silent between tool
    // calls even when it had something to say. Render it like a short
    // assistant remark, streamed in the same way a final answer is.
    const thoughtBlocks: any[] = Array.isArray(data?.thought) ? data.thought : [];
    const thoughtText = thoughtBlocks
      .map((block) => (typeof block?.text === "string" ? block.text : ""))
      .join("")
      .trim();
    if (thoughtText.length > 2) {
      items.push({
        kind: "assistant-text",
        id: "say-" + toolCallId,
        text: thoughtText,
        streaming: true,
      });
    }

    // Ongeza ThinkingCard kama reasoning_content ipo
    const reasoning = String(data?.reasoning_content ?? "").trim();
    if (reasoning) {
      items.push({
        kind: "thinking",
        id: "think-" + toolCallId,
        thought: reasoning,
      });
    }

    // The `finish` tool call carries the agent's final report in
    // `action.message` (confirmed by OpenHands' own event schema — see
    // REPORT.md). The old code path rendered nothing at all for `finish`
    // (Chat.tsx's ToolCard returns null for it, correctly — a "Ran finish"
    // row isn't useful), which meant that final message was silently
    // discarded and the user never saw the agent's summary. Surface it as
    // a normal assistant message instead of dropping it.
    if (toolName === "finish") {
      const finalMessage = String(action?.message ?? "").trim();
      if (finalMessage) {
        items.push({
          kind: "assistant-text",
          id: "final-" + toolCallId,
          text: finalMessage,
          streaming: true,
        });
      }
    }

    // Browser tools → kind "browser"
    if (toolName.startsWith("browser_")) {
      const bIdx = items.length;
      activeToolIndex.set(toolCallId, bIdx);
      items.push({
        kind: "browser",
        id: toolCallId,
        toolCallId,
        toolName,
        action,
        status: "running",
        startedAt: Date.now(),
      });
      return { items, activeToolIndex, assistantTextId, runStartedAt };
    }

    // Terminal with port → preview card
    if (toolName === "terminal") {
      const port = detectPort(String(action?.command || ""));
      if (port && !items.some((i) => i.kind === "preview" && (i as any).port === port)) {
        items.push({
          kind: "preview",
          id: "preview-" + port,
          port,
        });
      }
    }

    const idx = items.length;
    activeToolIndex.set(toolCallId, idx);
    items.push({
      kind: "tool",
      id: toolCallId,
      toolCallId,
      toolName,
      action,
      status: "running",
      startedAt: Date.now(),
    });
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  if (eventType === "ObservationEvent") {
    const toolCallId = String(data?.tool_call_id ?? "");
    if (!toolCallId) return { items, activeToolIndex, assistantTextId, runStartedAt };
    const idx = activeToolIndex.get(toolCallId);
    const obs = data?.observation;
    const status = resolveSettledStatus(obs);
    const tn = String(data?.tool_name ?? "");

    // Kama item haipo — unda mpya (ObservationEvent bila ActionEvent).
    //
    // This used to only fire for `browser_*` tools, so any tool whose
    // ObservationEvent arrives without a matching ActionEvent in this
    // stream — which is exactly what happens for MCP tool calls the
    // framework issues on its own (see the `project_info` call in
    // sample-events/openhands-events.jsonl, whose ObservationEvent has no
    // paired ActionEvent at all) — was silently dropped. Generalizing this
    // to every tool name is the fix for "MCP tools have no animation":
    // ToolCard already knows how to render an MCP call (McpToolCard) or
    // fall back to GenericToolCard for anything else, it just never got
    // the chance to run.
    if (idx === undefined || idx < 0 || idx >= items.length) {
      const isBrowser = tn.startsWith("browser_");
      const newIdx = items.length;
      activeToolIndex.set(toolCallId, newIdx);
      if (isBrowser) {
        items.push({
          kind: "browser",
          id: toolCallId,
          toolCallId,
          toolName: tn,
          action: {},
          observation: obs,
          status,
          startedAt: Date.now(),
          durationMs: 0,
        });
      } else {
        items.push({
          kind: "tool",
          id: toolCallId,
          toolCallId,
          toolName: tn || "unknown",
          action: {},
          observation: obs,
          status,
          startedAt: Date.now(),
          durationMs: 0,
        });
      }
      return { items, activeToolIndex, assistantTextId, runStartedAt };
    }
    const item = items[idx];

    if (item.kind === "tool" || item.kind === "browser") {
      items[idx] = {
        ...item,
        observation: obs,
        status,
        durationMs: Date.now() - item.startedAt,
      } as any;
      return { items, activeToolIndex, assistantTextId, runStartedAt };
    }

    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  if (eventType === "OpenHandsRunFinished") {
    const totalMs = runStartedAt ? Date.now() - runStartedAt : 0;
    items.push({
      kind: "complete",
      id: "complete-" + Date.now(),
      chips: [
        items.filter((i) => i.kind === "tool" || i.kind === "browser").length + " tools",
        items.filter((i) => i.kind === "assistant-text").length + " messages",
      ],
      totalMs,
    });
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  if (eventType === "ConversationErrorEvent" || eventType === "AgentErrorEvent") {
    const msg = String(
      data?.error ??
      data?.message ??
      data?.detail ??
      "Agent encountered an error",
    ).slice(0, 800);
    items.push({
      kind: "error",
      id: "err-" + Date.now(),
      message: msg,
    });
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  if (eventType === "OpenHandsRunError") {
    items.push({
      kind: "error",
      id: "error-" + Date.now(),
      message: String(data?.error ?? "Run failed").slice(0, 500),
    });
    return { items, activeToolIndex, assistantTextId, runStartedAt };
  }

  return { items, activeToolIndex, assistantTextId, runStartedAt };
}

export function getToolLabels(item: Extract<TimelineItem, { kind: "tool" }>) {
  return toolLabel(item.toolName, item.action);
}

export function getObservationText(item: Extract<TimelineItem, { kind: "tool" }>): string {
  const obs = item.observation;
  if (!obs) return "";
  return cleanAnsi(extractText(obs?.content));
}
