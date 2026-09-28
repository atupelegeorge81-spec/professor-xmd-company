import { useCallback, useEffect, useMemo, useState } from "react";
import { IconMoon, IconRefresh, IconSun } from "@tabler/icons-react";
import {
  AgentAvatar,
  ApprovalPrompt,
  BranchSwitcher,
  ChainOfThought,
  CheckpointCard,
  CodeStreamBlock,
  CountUp,
  DiffCard,
  DurationTicker,
  ErrorRetryCard,
  FileReadCard,
  FileTreeReveal,
  FileWriteCard,
  GenericToolCard,
  LiveCursorOverlay,
  McpToolCard,
  ModalReveal,
  MultiStepProgress,
  PlanCard,
  ProgressBar,
  QuestionPrompt,
  ReasoningStream,
  ScreenshotCard,
  ScrollToBottomPill,
  SearchCard,
  ShimmerText,
  Skeleton,
  SkeletonMessage,
  Spinner,
  StatusDot,
  StatusIcon,
  StatusPill,
  StepRail,
  StopGenerateButton,
  StreamingCaret,
  StreamingMarkdown,
  SubagentCard,
  TabSwitcher,
  TaskCompleteBanner,
  TaskGroupCard,
  TerminalCard,
  TerminalStream,
  TextGenerateEffect,
  ThinkingCard,
  TodoListCard,
  TokenUsageMeter,
  ToastStack,
  ToolRow,
  TypingDots,
  WebBrowseCard,
  VoiceWaveform,
  WaveVisualizer,
  type ToolStatus,
} from "..";

const RAW_OUTPUT =
  "\u001b[?2004l\r\u001b[01;34mworkspace\u001b[0m\nlogin.html\nserver.py\n\u001b[32mServing HTTP on 0.0.0.0 port 8000\u001b[0m";

const BEFORE = `export function Login() {\n  return <form />;\n}\n`;
const AFTER = `export function Login() {\n  return (\n    <form className="login">\n      <input name="email" />\n      <button>Sign in</button>\n    </form>\n  );\n}\n`;

/** Scripted timeline: each entry becomes running, then settles. */
const SCRIPT = [
  { id: "think", at: 0, done: 2600 },
  { id: "plan", at: 600, done: 3200 },
  { id: "tree", at: 2600, done: 4000 },
  { id: "terminal", at: 3200, done: 6000 },
  { id: "write", at: 5200, done: 7400 },
  { id: "diff", at: 6600, done: 8600 },
  { id: "search", at: 7400, done: 9400 },
  { id: "browse", at: 8600, done: 11000 },
  { id: "screenshot", at: 10200, done: 12000 },
  { id: "mcp", at: 11200, done: 13000 },
  { id: "subagent", at: 12000, done: 14200 },
  { id: "group", at: 1200, done: 14400 },
] as const;

type ScriptId = (typeof SCRIPT)[number]["id"];

function useScriptClock(runKey: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 100);
    return () => window.clearInterval(id);
  }, [runKey]);
  return elapsed;
}

function statusOf(id: ScriptId, elapsed: number): ToolStatus {
  const step = SCRIPT.find((entry) => entry.id === id);
  if (!step) return "pending";
  if (elapsed < step.at) return "pending";
  if (elapsed < step.done) return "running";
  return "success";
}

export function Demo() {
  const [dark, setDark] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [tab, setTab] = useState("timeline");
  const elapsed = useScriptClock(runKey);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const s = useCallback((id: ScriptId) => statusOf(id, elapsed), [elapsed]);
  const finished = elapsed > 14400;

  return (
    <div className="min-h-screen bg-px-bg text-px-fg">
      <header className="sticky top-0 z-20 border-b border-px-border bg-px-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <AgentAvatar size={24} state={finished ? "done" : "thinking"} />
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold">PROFESSOR-XMD animation kit</h1>
            <p className="text-[11.5px] text-px-fg-muted">
              {finished ? "Run finished" : "Agent running"} ·{" "}
              <DurationTicker running={!finished} durationMs={14400} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRunKey((key) => key + 1)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-px-border px-3 py-1 text-[12px] font-medium transition-colors hover:bg-px-surface"
          >
            <IconRefresh size={12} /> Replay
          </button>
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            aria-label="Toggle theme"
            className="rounded-full border border-px-border p-1.5 transition-colors hover:bg-px-surface"
          >
            {dark ? <IconSun size={13} /> : <IconMoon size={13} />}
          </button>
        </div>
        <div className="mx-auto max-w-3xl px-4">
          <TabSwitcher
            tabs={[
              { id: "timeline", label: "Timeline" },
              { id: "gallery", label: "Gallery" },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {tab === "timeline" ? (
          <Timeline s={s} elapsed={elapsed} finished={finished} runKey={runKey} />
        ) : (
          <Gallery />
        )}
      </main>
    </div>
  );
}

function Timeline({
  s,
  elapsed,
  finished,
  runKey,
}: {
  s: (id: ScriptId) => ToolStatus;
  elapsed: number;
  finished: boolean;
  runKey: number;
}) {
  const planItems = useMemo(
    () => [
      { id: "p1", title: "Inspect the workspace", status: s("tree") },
      { id: "p2", title: "Create the login page", status: s("write") },
      { id: "p3", title: "Serve it on localhost", status: s("terminal") },
    ],
    [s],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-px-lg border border-px-border bg-px-surface px-3 py-2 text-[13px]">
        Create a simple login page and host it locally
      </div>

      <MultiStepProgress
        steps={["Plan", "Build", "Serve", "Verify"]}
        current={Math.min(3, Math.floor(elapsed / 3800))}
      />

      <ThinkingCard
        key={`think-${runKey}`}
        status={s("think")}
        durationMs={2600}
        thought="The user wants a login page served locally. I'll inspect the workspace, write login.html, then start a static server on port 8000."
      />

      <PlanCard status={s("plan")} items={planItems} />

      <TaskGroupCard
        status={s("group")}
        activeLabel="Building the login page"
        summary={["2 files", "1 search", "1 command"]}
        durationMs={13200}
        items={[
          { id: "g1", label: "Scanned workspace", status: s("tree") },
          { id: "g2", label: "Created login.html", status: s("write") },
          { id: "g3", label: "Started dev server", status: s("terminal") },
        ]}
      />

      <GenericToolCard
        status={s("tree")}
        name="project_info"
        activeLabel="Scanning workspace"
        label="Scanned workspace"
        detail="/workspace"
        durationMs={1400}
        defaultExpanded
      >
        <FileTreeReveal
          key={`tree-${runKey}`}
          scanning={s("tree") === "running"}
          nodes={[
            { id: "n1", name: "workspace", depth: 0, kind: "folder" },
            { id: "n2", name: "static", depth: 1, kind: "folder" },
            { id: "n3", name: "login.html", depth: 2, kind: "file", highlight: true },
            { id: "n4", name: "server.py", depth: 1, kind: "file" },
          ]}
        />
      </GenericToolCard>

      <TerminalCard
        status={s("terminal")}
        command="python3 -m http.server 8000"
        output={RAW_OUTPUT}
        exitCode={0}
        durationMs={2800}
      />

      <FileWriteCard status={s("write")} path="/workspace/static/login.html" bytes={1840} additions={42} durationMs={2200} />

      <DiffCard status={s("diff")} path="/workspace/src/Login.tsx" before={BEFORE} after={AFTER} durationMs={2000} />

      <SearchCard
        status={s("search")}
        kind="web"
        query="accessible login form best practices"
        durationMs={2000}
        results={[
          { id: "r1", title: "Login form accessibility", location: "https://www.w3.org/WAI/tutorials/forms/", snippet: "Label every input and keep focus order predictable." },
          { id: "r2", title: "Password field UX", location: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/password" },
        ]}
      />

      <WebBrowseCard status={s("browse")} url="http://localhost:8000/static/login.html" title="Login" durationMs={2400} />

      <ScreenshotCard status={s("screenshot")} durationMs={1800} caption="localhost:8000" />

      <McpToolCard
        status={s("mcp")}
        server="github"
        tool="create_issue"
        input={{ title: "Add login page", labels: ["ui"] }}
        output={{ number: 42, url: "https://github.com/acme/app/issues/42" }}
        durationMs={1800}
      />

      <SubagentCard
        status={s("subagent")}
        name="reviewer"
        task="Review the login markup for accessibility"
        result="Labels and focus order look correct; added an autocomplete hint."
        durationMs={2200}
      />

      {finished && (
        <TaskCompleteBanner chips={["2 files", "1 command", "1 search"]} totalMs={14400} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-px-fg-subtle">{title}</h2>
      <div className="flex flex-col gap-2 rounded-px-lg border border-px-border bg-px-bg p-3">{children}</div>
    </section>
  );
}

function Gallery() {
  // Was a plain running/done checkbox; extended to a 3-way switch so the
  // new "timeout" status (SHIDA 4 — distinct orange, neither success nor
  // error) actually gets exercised somewhere in the component gallery
  // instead of only existing in code.
  const [statusChoice, setStatusChoice] = useState<"running" | "success" | "timeout">("running");
  const running = statusChoice === "running";
  const status: ToolStatus = statusChoice;
  const [modal, setModal] = useState(false);
  const [branch, setBranch] = useState(1);
  const [toasts, setToasts] = useState([
    { id: "t1", title: "Sandbox ready", description: "E2B instance booted", tone: "info" as const },
    { id: "t2", title: "File saved", tone: "success" as const },
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 text-[12.5px]">
        <span className="text-px-fg-muted mr-1">Status:</span>
        {(["running", "success", "timeout"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusChoice(s)}
            className={
              "rounded-full px-2.5 py-1 font-medium capitalize transition-colors " +
              (statusChoice === s
                ? "bg-px-accent text-white"
                : "bg-px-surface-2 text-px-fg-muted hover:text-px-fg")
            }
          >
            {s}
          </button>
        ))}
      </div>

      <Section title="Primitives">
        <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
          <Spinner />
          <ShimmerText>Thinking</ShimmerText>
          <StatusIcon status={status} />
          <StatusDot pulsing={running} />
          <StatusPill status={status} />
          <DurationTicker running={running} durationMs={4200} />
          <CountUp value={running ? 1200 : 18400} compact />
          <TypingDots />
          <span>
            Streaming<StreamingCaret />
          </span>
          <AgentAvatar state={running ? "thinking" : "done"} />
          <VoiceWaveform state={running ? "speaking" : "idle"} />
        </div>
        <ProgressBar value={running ? undefined : 1} />
        <TokenUsageMeter used={running ? 24000 : 96000} limit={128000} />
        <div className="flex gap-3">
          <StepRail status={status} />
          <Skeleton width="60%" />
        </div>
        <SkeletonMessage lines={2} />
        <div className="flex items-center gap-4">
          <StopGenerateButton generating={running} />
          <ScrollToBottomPill visible count={3} />
          <BranchSwitcher index={branch} total={3} onChange={setBranch} />
        </div>
        <WaveVisualizer state={running ? "speaking" : "idle"} />
      </Section>

      <Section title="Tool rows">
        <ToolRow status={status} activeLabel="Doing work" label="Did work" detail="generic row" durationMs={1200}>
          <p className="text-[12.5px] text-px-fg-muted">Expandable body.</p>
        </ToolRow>
        <ThinkingCard status={status} durationMs={3100} thought="Reasoning text." />
        <ReasoningStream status={status} text="Checking the workspace layout before writing any files." durationMs={2400} />
        <FileReadCard status={status} path="/workspace/server.py" lineCount={84} preview="import http.server" />
        <FileWriteCard status={status} path="/workspace/login.html" bytes={1840} additions={42} />
        <DiffCard status={status} path="/workspace/Login.tsx" before={BEFORE} after={AFTER} />
        <TerminalCard status={status} command="ls -la" output={RAW_OUTPUT} exitCode={0} />
        <SearchCard status={status} kind="code" query="handleLogin" results={[{ id: "a", title: "Login.tsx", location: "src/Login.tsx" }]} />
        <WebBrowseCard status={status} url="https://example.com" title="Example" />
        <ScreenshotCard status={status} />
        <McpToolCard status={status} server="github" tool="list_issues" input={{ state: "open" }} output={{ count: 3 }} />
        <SubagentCard status={status} name="tester" task="Run the test suite" result="12 passed" />
      </Section>

      <Section title="Task & control">
        <ChainOfThought
          steps={[
            { id: "c1", label: "Read the request", status: "success" },
            { id: "c2", label: "Inspect the repo", status },
            { id: "c3", label: "Write the page", status: "pending" },
          ]}
        />
        <TodoListCard
          items={[
            { id: "t1", title: "Create login.html", state: "done" },
            { id: "t2", title: "Serve on :8000", state: running ? "doing" : "done" },
            { id: "t3", title: "Verify in browser", state: "todo" },
          ]}
        />
        <MultiStepProgress steps={["Plan", "Build", "Verify"]} current={running ? 1 : 3} />
        <CheckpointCard label="Checkpoint · login page" timestamp="2 min ago" chips={["2 files"]} current onRollback={() => undefined} />
        <ApprovalPrompt request="rm -rf build" reason="Agent wants to clear the build directory." />
        <QuestionPrompt
          question="Which styling should the login page use?"
          options={[
            { id: "o1", label: "Plain CSS", description: "No build step" },
            { id: "o2", label: "Tailwind", description: "Utility classes" },
          ]}
        />
        <ErrorRetryCard message={"\u001b[31mError:\u001b[0m port 8000 already in use"} attempt={2} maxAttempts={3} onRetry={() => undefined} />
        <TaskCompleteBanner chips={["3 files", "8 tools"]} totalMs={42000} />
      </Section>

      <Section title="Text, code & chrome">
        <StreamingMarkdown streaming={running} text={"# Done\nThe **login page** is live at `localhost:8000`.\n- HTML written\n- Server started"} />
        <TextGenerateEffect text="Word by word reveal for finished answers." />
        <CodeStreamBlock streaming={running} filename="login.tsx" code={AFTER} />
        <TerminalStream streaming={running} lines={["$ python3 -m http.server 8000", "Serving HTTP on 0.0.0.0 port 8000", "127.0.0.1 - - GET /login.html 200"]} />
        <LiveCursorOverlay point={{ x: 55, y: 45, click: running, label: "Sign in" }}>
          <div className="h-28 w-full rounded-px bg-px-surface-2" />
        </LiveCursorOverlay>
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((list) => list.filter((t) => t.id !== id))} />
        <button
          type="button"
          onClick={() => setModal(true)}
          className="self-start rounded-full border border-px-border px-3 py-1 text-[12px]"
        >
          Open modal
        </button>
        <div className="relative">
          <ModalReveal open={modal} title="Artifact preview" onClose={() => setModal(false)}>
            <CodeStreamBlock filename="login.html" code={"<form>\n  <input name=\"email\" />\n</form>"} />
          </ModalReveal>
        </div>
      </Section>
    </div>
  );
}
