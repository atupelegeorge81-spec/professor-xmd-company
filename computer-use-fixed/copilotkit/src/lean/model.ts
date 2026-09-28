// XMD-Lean — model ya UI. Events (kutoka server, kwa SSE) zinakunjwa humu
// kwa mpangilio: Run -> Step -> {mawazo, maelezo, draft ya amri, utekelezaji}.
// Model inabadilishwa moja kwa moja (mutable) kwa kasi; UI inachora kila frame.

export type LeanEvent = {
  type: string;
  i: number;
  ts: number;
  runId?: string;
  step?: number;
  [k: string]: unknown;
};

export type ExecKind =
  | "skill" | "search" | "browse" | "check" | "git" | "deploy" | "map"
  | "read" | "list" | "pkg" | "bash" | "write" | "error";

export interface Exec {
  id: string;
  step: number;
  runId: string;
  tool: string;
  kind: ExecKind;
  command?: string;
  path?: string;
  lines?: number;
  content?: string;
  existed?: boolean;
  output: string;
  status: "running" | "ok" | "fail";
  startTs: number;
  endTs?: number;
  exit?: number;
  ms?: number;
  chars?: number;
  truncated?: boolean;
  file?: string;
  added?: number;
  removed?: number;
  summary?: string;
}

export interface Step {
  n: number;
  runStep: number;
  maxSteps: number;
  startTs: number;
  endTs?: number;
  think: { text: string; startTs?: number; ms?: number; open: boolean };
  text: { s: string; open: boolean };
  draft?: { id: string; name: string; preview: string; content?: string; ts: number };
  exec?: Exec;
  usage?: { prompt: number; completion: number };
  notes: { kind: string; text: string }[];
}

export type RunStatus = "running" | "done" | "error" | "stopped" | "stuck" | "interrupted";

export interface Run {
  id: string;
  task: string;
  status: RunStatus;
  startTs: number;
  endTs?: number;
  model?: string;
  size?: string;
  protocol?: string;
  budget?: { steps: number; tokens: number };
  skills: { name: string; via: string; chars: number }[];
  steps: Step[];
  report?: string;
  partial?: boolean;
  usage: { prompt: number; completion: number; cached: number; total: number; budget: number };
  end?: { steps: number; ms: number; total: number; prompt: number; completion: number; cached: number; calls: number };
  notes: { kind: string; text: string }[];
}

export interface Model {
  runs: Run[];
  execs: Exec[];
  lastI: number;
  threadTotal: number;
  version: number;
}

export const emptyModel = (): Model => ({ runs: [], execs: [], lastI: -1, threadTotal: 0, version: 0 });

const MAX_OUT = 400_000;
// ANSI + udhibiti wa \r (progress bars zinaandika mstari ule ule)
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

export function appendOutput(prev: string, chunk: string): string {
  let s = prev + chunk.replace(ANSI, "");
  if (s.includes("\r")) {
    s = s
      .split("\n")
      .map((line) => {
        if (!line.includes("\r")) return line;
        const parts = line.split("\r").filter((p, idx, arr) => p !== "" || idx === arr.length - 1);
        return parts[parts.length - 1] ?? "";
      })
      .join("\n");
  }
  if (s.length > MAX_OUT) s = "…\n" + s.slice(s.length - MAX_OUT);
  return s;
}

function num(v: unknown, d = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}
function str(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}

function runFor(m: Model, ev: LeanEvent): Run | undefined {
  const id = ev.runId;
  if (!id) return m.runs[m.runs.length - 1];
  return m.runs.find((r) => r.id === id);
}

function stepFor(run: Run, ev: LeanEvent): Step | undefined {
  if (typeof ev.step === "number") {
    for (let k = run.steps.length - 1; k >= 0; k--) if (run.steps[k].n === ev.step) return run.steps[k];
  }
  return run.steps[run.steps.length - 1];
}

function closeStep(s: Step | undefined, ts: number) {
  if (!s) return;
  if (s.think.open) {
    s.think.open = false;
    if (s.think.ms == null && s.think.startTs) s.think.ms = ts - s.think.startTs;
  }
  s.text.open = false;
  if (!s.endTs) s.endTs = ts;
}

export function apply(m: Model, ev: LeanEvent): void {
  if (ev.i <= m.lastI) return; // tayari imeshaingia (replay + live)
  m.lastI = ev.i;
  m.version++;
  const ts = num(ev.ts, Date.now());

  if (ev.type === "user") {
    m.runs.push({
      id: str(ev.runId, "r" + ev.i), task: str(ev.text), status: "running", startTs: ts,
      skills: [], steps: [], notes: [],
      usage: { prompt: 0, completion: 0, cached: 0, total: 0, budget: 0 },
    });
    return;
  }
  const run = runFor(m, ev);
  if (!run) return;

  switch (ev.type) {
    case "run_start": {
      run.model = str(ev.model);
      run.size = str(ev.size);
      run.protocol = str(ev.protocol);
      const b = ev.budget as { steps: number; tokens: number } | undefined;
      if (b) { run.budget = b; run.usage.budget = b.tokens; }
      break;
    }
    case "skill_loaded":
      run.skills.push({ name: str(ev.name), via: str(ev.via), chars: num(ev.chars) });
      break;
    case "step_start": {
      closeStep(run.steps[run.steps.length - 1], ts);
      run.steps.push({
        n: num(ev.step), runStep: num(ev.run_step), maxSteps: num(ev.max_steps), startTs: ts,
        think: { text: "", open: false }, text: { s: "", open: false }, notes: [],
      });
      break;
    }
    case "think_start": {
      const s = stepFor(run, ev);
      if (s) { s.think.open = true; s.think.startTs = ts; }
      break;
    }
    case "think_delta": {
      const s = stepFor(run, ev);
      if (s) { s.think.text += str(ev.text); s.think.open = true; s.think.startTs ??= ts; }
      break;
    }
    case "think_end": {
      const s = stepFor(run, ev);
      if (s) { s.think.open = false; s.think.ms = num(ev.ms, s.think.startTs ? ts - s.think.startTs : 0); }
      break;
    }
    case "text_start": {
      const s = stepFor(run, ev);
      if (s) { s.text.open = true; if (s.think.open) { s.think.open = false; s.think.ms ??= s.think.startTs ? ts - s.think.startTs : 0; } }
      break;
    }
    case "text_delta": {
      const s = stepFor(run, ev);
      if (s) { s.text.s += str(ev.text); s.text.open = true; }
      break;
    }
    case "text_end": {
      const s = stepFor(run, ev);
      if (s) s.text.open = false;
      break;
    }
    case "tool_draft": {
      const s = stepFor(run, ev);
      if (s) {
        if (s.think.open) { s.think.open = false; s.think.ms ??= s.think.startTs ? ts - s.think.startTs : 0; }
        s.text.open = false;
        s.draft = { id: str(ev.id), name: str(ev.name), preview: str(ev.preview), content: ev.content as string | undefined, ts };
      }
      break;
    }
    case "usage": {
      const s = stepFor(run, ev);
      if (s) s.usage = { prompt: num(ev.prompt), completion: num(ev.completion) };
      run.usage = {
        prompt: num(ev.run_prompt), completion: num(ev.run_completion), cached: num(ev.run_cached),
        total: num(ev.run_total), budget: num(ev.budget, run.usage.budget),
      };
      m.threadTotal = num(ev.thread_total, m.threadTotal);
      break;
    }
    case "exec_start": {
      const s = stepFor(run, ev);
      const x: Exec = {
        id: str(ev.id, "x" + ev.i), step: num(ev.step), runId: run.id, tool: str(ev.tool),
        kind: (str(ev.kind, "bash") as ExecKind), command: ev.command as string | undefined,
        path: ev.path as string | undefined, lines: ev.lines as number | undefined,
        content: ev.preview as string | undefined, existed: ev.existed as boolean | undefined,
        output: "", status: "running", startTs: ts,
      };
      if (s) { s.exec = x; s.draft = undefined; if (s.think.open) s.think.open = false; s.text.open = false; }
      m.execs.push(x);
      break;
    }
    case "exec_output": {
      const x = m.execs.find((e) => e.id === ev.id && e.runId === run.id);
      if (x) x.output = appendOutput(x.output, str(ev.chunk));
      break;
    }
    case "exec_end": {
      const x = m.execs.find((e) => e.id === ev.id && e.runId === run.id);
      if (x) {
        x.exit = num(ev.exit);
        x.status = x.exit === 0 ? "ok" : "fail";
        x.endTs = ts;
        x.ms = num(ev.ms);
        x.chars = num(ev.chars);
        x.truncated = !!ev.truncated;
        x.file = ev.file as string | undefined;
        x.added = ev.added as number | undefined;
        x.removed = ev.removed as number | undefined;
        x.summary = ev.summary as string | undefined;
        if (!x.output && x.summary) x.output = x.summary;
      }
      break;
    }
    case "guard":
    case "notice": {
      const note = { kind: ev.type === "guard" ? str(ev.kind, "guard") : "notice", text: str(ev.message ?? ev.text) };
      const s = run.steps[run.steps.length - 1];
      (s ?? run).notes.push(note);
      break;
    }
    case "error": {
      run.notes.push({ kind: "error", text: str(ev.message) });
      break;
    }
    case "finish": {
      closeStep(run.steps[run.steps.length - 1], ts);
      run.report = str(ev.report);
      run.partial = !!ev.partial;
      break;
    }
    case "run_end": {
      closeStep(run.steps[run.steps.length - 1], ts);
      run.status = (str(ev.status, "done") as RunStatus);
      run.endTs = ts;
      // amri ambayo haikupata exec_end (stop/kukatika) -> imesimamishwa
      for (const x of m.execs) if (x.runId === run.id && x.status === "running") { x.status = "fail"; x.endTs = ts; }
      for (const s of run.steps) s.draft = undefined;
      if (typeof ev.total === "number") {
        run.end = {
          steps: num(ev.steps), ms: num(ev.ms), total: num(ev.total), prompt: num(ev.prompt),
          completion: num(ev.completion), cached: num(ev.cached), calls: num(ev.calls),
        };
        if (typeof ev.thread_total === "number") m.threadTotal = ev.thread_total;
      }
      break;
    }
  }
}

// ---- msaada kwa UI
export type Phase = "idle" | "starting" | "thinking" | "writing" | "drafting" | "running" | "finishing";

export function livePhase(run: Run | undefined): { phase: Phase; label: string; exec?: Exec } {
  if (!run || run.status !== "running") return { phase: "idle", label: "" };
  const s = run.steps[run.steps.length - 1];
  if (!s) return { phase: "starting", label: "Inaanza…" };
  if (s.exec && s.exec.status === "running") return { phase: "running", label: execLabel(s.exec, true), exec: s.exec };
  if (s.draft) {
    return { phase: "drafting", label: s.draft.name === "finish" ? "Inaandika ripoti" : s.draft.name === "write_file" ? "Inaandaa faili" : "Inaandika amri" };
  }
  if (s.text.open) return { phase: "writing", label: "Inaeleza" };
  if (s.think.open) return { phase: "thinking", label: "Inafikiri" };
  if (s.exec) return { phase: "thinking", label: "Inasoma matokeo" };
  return { phase: "thinking", label: "Inafikiri" };
}

export function execLabel(x: Exec, live: boolean): string {
  const f = (a: string, b: string) => (live ? a : b);
  const base = (p?: string) => (p ? p.split("/").pop() : "");
  switch (x.kind) {
    case "write": return f(`Inaandika ${base(x.path)}`, x.existed ? `Imehariri ${base(x.path)}` : `Imeunda ${base(x.path)}`);
    case "search": return f("Inatafuta mtandaoni", "Imetafuta mtandaoni");
    case "browse": return f("Inasoma ukurasa", "Imesoma ukurasa");
    case "check": return f("Inakagua URL", "Imekagua URL");
    case "git": return f("Inatumia Git", "Imetumia Git");
    case "deploy": return f("Inaweka mtandaoni", "Imeweka mtandaoni");
    case "map": return f("Inachora ramani ya mradi", "Ramani ya mradi");
    case "read": return f("Inasoma faili", "Imesoma faili");
    case "list": return f("Inaorodhesha mafaili", "Imeorodhesha mafaili");
    case "pkg": return f("Inasakinisha packages", "Imesakinisha packages");
    case "skill": return f("Inapakia skill", "Imepakia skill");
    case "error": return "Amri batili";
    default: return f("Inaendesha amri", "Imeendesha amri");
  }
}

export function fmtMs(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const mm = Math.floor(s / 60);
  return `${mm}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function fmtTok(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "K";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export function wsRel(p?: string): string | undefined {
  if (!p) return undefined;
  const k = p.lastIndexOf("/ws/");
  return k >= 0 ? p.slice(k + 4) : undefined;
}
