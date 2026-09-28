import {
  Spinner,
  ThinkingCard,
  TerminalCard,
  FileWriteCard,
  FileReadCard,
  DiffCard,
  SearchCard,
  McpToolCard,
  GenericToolCard,
  StreamingMarkdown,
  MultiStepProgress,
  TaskCompleteBanner,
  ErrorRetryCard,
  WebBrowseCard,
  ScreenshotCard,
  useSettledStatus,
} from "./agent-anim";
import { isRunning } from "./agent-anim/types";
import {
  getObservationText,
  getToolLabels,
  type TimelineItem,
} from "./openhands-to-timeline";
import { PreviewPanel } from "./PreviewPanel";

export function extractBrowserUrl(action: any, observation?: any): string {
  const u1 = String(action?.url || "");
  if (u1 && u1 !== "about:blank") return u1;

  if (Array.isArray(observation?.content)) {
    for (const c of observation.content) {
      if (typeof c?.text === "string" && c.text.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(c.text);
          if (parsed?.url) return String(parsed.url);
        } catch {}
      }
    }
  }
  return u1 || "about:blank";
}

export function extractScreenshot(observation: any): string | undefined {
  if (!observation) return undefined;

  const toDataUrl = (raw: string): string => {
    if (raw.startsWith("data:image")) return raw;
    if (raw.startsWith("iVBOR")) return "data:image/png;base64," + raw;
    if (raw.startsWith("/9j/")) return "data:image/jpeg;base64," + raw;
    return "data:image/png;base64," + raw;
  };

  const sd = observation.screenshot_data;
  if (typeof sd === "string" && sd.length > 100) return toDataUrl(sd);

  const sc = observation.screenshot;
  if (typeof sc === "string" && sc.length > 100) return toDataUrl(sc);

  if (Array.isArray(observation.content)) {
    for (const c of observation.content) {
      if (typeof c?.text === "string" && c.text.startsWith("data:image")) return c.text;
      if (typeof c?.image_url === "string") return c.image_url;
    }
  }
  return undefined;
}

function ToolCard({ item }: { item: Extract<TimelineItem, { kind: "tool" }> }) {
  const labels = getToolLabels(item);
  const obs = getObservationText(item);
  // Anti-flicker: never let a tool row flash straight past "running" for
  // trivial (near-instant) operations — see useSettledStatus / SHIDA 1.
  const status = useSettledStatus(item.status, isRunning);
  const base = {
    status,
    startedAt: item.startedAt,
    durationMs: item.durationMs,
  };
  const running = status === "running" || status === "pending";

  if (item.toolName === "terminal") {
    return (
      <TerminalCard
        {...base}
        command={String(item.action?.command ?? "")}
        output={obs}
        exitCode={item.observation?.exit_code}
        defaultExpanded={running}
      />
    );
  }

  if (item.toolName === "file_editor") {
    const cmd = String(item.action?.command ?? "");
    if (cmd === "create") {
      return (
        <FileWriteCard
          {...base}
          path={String(item.action?.path ?? "")}
          bytes={obs.length}
          defaultExpanded={running}
        />
      );
    }
    if (cmd === "view") {
      return (
        <FileReadCard
          {...base}
          path={String(item.action?.path ?? "")}
          preview={obs.slice(0, 2000)}
          defaultExpanded={running}
        />
      );
    }
    if (cmd === "str_replace" || cmd === "insert") {
      return (
        <DiffCard
          {...base}
          path={String(item.action?.path ?? "")}
          before={String(item.action?.old_str ?? "")}
          after={String(item.action?.new_str ?? "")}
          defaultExpanded={running}
        />
      );
    }
    return (
      <GenericToolCard
        {...base}
        name={item.toolName}
        activeLabel={labels.active}
        label={labels.done}
        detail={labels.detail}
        defaultExpanded={running}
      >
        <pre className="text-[11px] text-px-fg-muted whitespace-pre-wrap">
          {JSON.stringify(item.action, null, 2)}
        </pre>
      </GenericToolCard>
    );
  }

  if (item.toolName === "think") {
    return (
      <ThinkingCard
        {...base}
        thought={String(item.action?.thought || item.observation?.content?.[0]?.text || "")}
        activeLabel="Thinking"
        defaultExpanded={running}
      />
    );
  }

  if (item.toolName === "glob" || item.toolName === "grep" || item.toolName === "search") {
    return (
      <SearchCard
        {...base}
        kind={item.toolName === "grep" ? "code" : "files"}
        query={String(item.action?.pattern ?? item.action?.query ?? "")}
        results={[]}
        defaultExpanded={running}
      />
    );
  }

  // MCP tools. Detect via the `kind` discriminator OpenHands actually puts
  // on the observation/action (`MCPToolObservation` / `MCPToolAction`)
  // instead of only special-casing the one tool name ("project_info") the
  // sample data happened to contain — this is what let *other* MCP tools
  // fall through to the generic card with no MCP framing at all.
  const isMcp =
    item.toolName === "project_info" ||
    item.action?.kind === "MCPToolAction" ||
    item.observation?.kind === "MCPToolObservation";
  if (isMcp) {
    return (
      <McpToolCard
        {...base}
        server="professor-xmd"
        tool={item.toolName}
        input={item.action?.args ?? item.action}
        output={item.observation?.content}
        defaultExpanded={running}
      />
    );
  }

  if (item.toolName === "finish") return null;

  return (
    <GenericToolCard
      {...base}
      name={item.toolName}
      activeLabel={labels.active}
      label={labels.done}
      detail={labels.detail}
      defaultExpanded={running}
    >
      <pre className="text-[11px] text-px-fg-muted whitespace-pre-wrap">
        {JSON.stringify(item.action, null, 2)}
      </pre>
    </GenericToolCard>
  );
}

function BrowserCard({ item }: { item: Extract<TimelineItem, { kind: "browser" }> }) {
  const status = useSettledStatus(item.status, isRunning);
  const url = extractBrowserUrl(item.action, item.observation);
  const screenshot = extractScreenshot(item.observation);
  const isNavigate =
    item.toolName === "browser_navigate" || item.toolName === "browser_navigate_back";

  if (screenshot) {
    return (
      <ScreenshotCard
        status={status}
        imageUrl={screenshot}
        caption={url}
        durationMs={item.durationMs}
        startedAt={item.startedAt}
        defaultExpanded={true}
      />
    );
  }
  if (isNavigate) {
    return (
      <WebBrowseCard
        status={status}
        url={url}
        durationMs={item.durationMs}
        startedAt={item.startedAt}
        defaultExpanded={true}
      />
    );
  }
  return (
    <div className="text-xs text-px-fg-muted p-2 font-mono border border-px-border rounded-px">
      {item.toolName} → {status}
    </div>
  );
}

export type RenderOptions = {
  onImageClick?: (src: string) => void;
};

/**
 * Renders a single timeline item. Shared by the live Chat view and the
 * sample-run replay demo so a fix made here is exercised — and verified —
 * in both places, instead of the demo drifting from what production
 * actually renders.
 */
export function renderTimelineItem(item: TimelineItem, options: RenderOptions = {}) {
  const { onImageClick } = options;

  if (item.kind === "user") {
    return (
      <div key={item.id} className="self-end max-w-[85%] rounded-px bg-px-surface px-3 py-2 text-[13px]">
        {item.text}
      </div>
    );
  }
  if (item.kind === "assistant-text") {
    return <StreamingMarkdown key={item.id} text={item.text} streaming={item.streaming} />;
  }
  if (item.kind === "preview") {
    return (
      <div key={item.id} className="my-2">
        <PreviewPanel port={item.port} />
      </div>
    );
  }
  if (item.kind === "browser") {
    const screenshot = extractScreenshot(item.observation);
    if (screenshot && onImageClick) {
      return (
        <div
          key={item.id}
          onClick={() => onImageClick(screenshot)}
          className="cursor-zoom-in"
          title="Click to enlarge"
        >
          <BrowserCard item={item} />
        </div>
      );
    }
    return <BrowserCard key={item.id} item={item} />;
  }
  if (item.kind === "tool") {
    return <ToolCard key={item.id} item={item} />;
  }
  if (item.kind === "thinking") {
    return (
      <ThinkingCard
        key={item.id}
        status="success"
        thought={item.thought}
        activeLabel="Thought"
      />
    );
  }
  if (item.kind === "boot") {
    return (
      <div key={item.id} className="rounded-px border border-px-border bg-px-surface p-3">
        <div className="flex items-center gap-2 text-[13px] text-px-fg-muted mb-2">
          <Spinner />
          <span>{item.label}...</span>
        </div>
        <MultiStepProgress steps={["Sandbox", "MCP", "OpenHands", "Agent"]} current={item.current} />
      </div>
    );
  }
  if (item.kind === "complete") {
    return <TaskCompleteBanner key={item.id} chips={item.chips} totalMs={item.totalMs} />;
  }
  if (item.kind === "error") {
    return <ErrorRetryCard key={item.id} message={item.message} />;
  }
  return null;
}
