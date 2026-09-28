import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Sandbox } from "@e2b/code-interpreter";

const app = express();
const PORT = 8000;

const UI_DIST_DIR = path.join(
  process.cwd(),
  "copilotkit",
  "dist",
);

app.use(express.static(UI_DIST_DIR));


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  }),
);

app.use(express.json());

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL =
  process.env.LLM_MODEL ?? "openai/deepseek/deepseek-v4-pro";
const LLM_BASE_URL =
  process.env.LLM_BASE_URL ?? "https://api.xkiro.com/v1";
const SEARCH_ENGINE_URL =
  process.env.SEARCH_ENGINE_URL ?? "https://searxng-northflank.onrender.com";

if (!LLM_API_KEY) {
  console.error("❌ LLM_API_KEY haijawekwa");
  process.exit(1);
}

type RunInput = {
  threadId?: string;
  runId?: string;
  messages?: Array<{
    role?: string;
    content?: unknown;
  }>;
};

function getUserTask(input: RunInput): string {
  const messages = input.messages ?? [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (
      message?.role === "user" &&
      typeof message.content === "string"
    ) {
      return message.content;
    }
  }

  return "";
}

const RUNS_DIR = ".runtime/runs";

type RunStatus =
  | "running"
  | "completed"
  | "error";

type PersistedRun = {
  threadId: string;
  runId: string;
  task: string;
  status: RunStatus;
  sandboxId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const runClients = new Map<
  string,
  Set<express.Response>
>();

function ensureRunStore() {
  fs.mkdirSync(
    RUNS_DIR,
    {
      recursive: true,
    },
  );
}

function runFile(
  runId: string,
) {
  return `${RUNS_DIR}/${runId}.json`;
}

function eventsFile(
  runId: string,
) {
  return `${RUNS_DIR}/${runId}.events.jsonl`;
}

function saveRun(
  run: PersistedRun,
) {
  ensureRunStore();

  fs.writeFileSync(
    runFile(run.runId),
    JSON.stringify(
      run,
      null,
      2,
    ),
    "utf8",
  );
}

function loadRun(
  runId: string,
): PersistedRun | null {
  try {
    return JSON.parse(
      fs.readFileSync(
        runFile(runId),
        "utf8",
      ),
    );
  } catch {
    return null;
  }
}

function appendRunEvent(
  runId: string,
  event: Record<string, unknown>,
) {
  ensureRunStore();

  fs.appendFileSync(
    eventsFile(runId),
    JSON.stringify(event) + "\n",
    "utf8",
  );

  broadcastGlobal({
    ...event,
    runId,
  });
}

function readRunEvents(
  runId: string,
): Record<string, unknown>[] {
  try {
    return fs
      .readFileSync(
        eventsFile(runId),
        "utf8",
      )
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(
        (
          value,
        ): value is Record<string, unknown> =>
          value !== null &&
          typeof value === "object",
      );
  } catch {
    return [];
  }
}

function writeSse(
  res: express.Response,
  event: Record<string, unknown>,
) {
  if (
    (res as any).writableEnded ||
    (res as any).destroyed
  ) {
    return;
  }

  try {
    res.write(
      `data: ${JSON.stringify(event)}\n\n`,
    );

    (res as any).flush?.();
  } catch {
    // Browser inaweza kuwa imeondoka.
  }
}

const globalClients = new Set<express.Response>();

function broadcastGlobal(
  event: Record<string, unknown>,
) {
  for (const client of [...globalClients]) {
    if (
      (client as any).writableEnded ||
      (client as any).destroyed
    ) {
      globalClients.delete(client);
      continue;
    }
    writeSse(client, event);
  }
}

function addRunClient(
  runId: string,
  res: express.Response,
) {
  let clients =
    runClients.get(runId);

  if (!clients) {
    clients = new Set();

    runClients.set(
      runId,
      clients,
    );
  }

  clients.add(res);
}

function removeRunClient(
  runId: string,
  res: express.Response,
) {
  const clients =
    runClients.get(runId);

  if (!clients) {
    return;
  }

  clients.delete(res);

  if (clients.size === 0) {
    runClients.delete(runId);
  }
}

function sendEvent(
  res: express.Response,
  event: Record<string, unknown>,
) {
  const runId =
    String(
      (res as any).__professorXmdRunId ??
      "",
    );

  if (!runId) {
    writeSse(
      res,
      event,
    );

    return;
  }

  appendRunEvent(
    runId,
    event,
  );

  const clients =
    runClients.get(runId);

  if (!clients) {
    return;
  }

  for (
    const client of [...clients]
  ) {
    if (
      (client as any).writableEnded ||
      (client as any).destroyed
    ) {
      clients.delete(client);
      continue;
    }

    writeSse(
      client,
      event,
    );
  }
}


const MCP_SERVER = String.raw`
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const server = new McpServer({
  name: "professor-xmd-tools",
  version: "1.0.0",
});

server.registerTool(
  "project_info",
  {
    description:
      "Returns information about the current PROFESSOR-XMD test workspace.",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          project: "PROFESSOR-XMD",
          environment: "computer-use",
          status: "ready",
        }),
      },
    ],
  }),
);

serveStdio(() => server);
`;

const OPENHANDS_AGENT = String.raw`
import os
import json
import traceback
from pathlib import Path

from pydantic import SecretStr

from openhands.sdk import LLM, Agent, AgentContext, Conversation, Tool

# KILL prompt_cache_key: LiteLLM drops unsupported params automatically
import litellm
litellm.drop_params = True
from openhands.sdk.conversation import ConversationVisualizerBase
from openhands.sdk.event import Event

from openhands.tools.file_editor import FileEditorTool
from openhands.tools.terminal import TerminalTool
from openhands.tools.browser_use import BrowserToolSet


# ------------------------------------------------------------------
# Self-awareness context (SHIDA 8 fix).
#
# This is appended to the agent's normal system prompt via
# AgentContext.system_message_suffix — the officially supported way to add
# instructions without replacing OpenHands' own prompt template or
# touching the event/SSE pipeline at all. Deliberately NOT a step-by-step
# script: the agent is told what it has and where it is, then left to
# decide how to use it, per the "usimpe hatua kwa hatua" instruction.
# ------------------------------------------------------------------
SEARCH_ENGINE_URL = os.environ.get(
    "SEARCH_ENGINE_URL", "https://searxng-northflank.onrender.com"
)

SELF_AWARENESS_PROMPT = f"""
## Your environment (PROFESSOR-XMD)

You are an autonomous computer-use agent running inside a disposable E2B
Linux sandbox. Here is what you have to work with:

- Workspace: /code/project -- this is your working directory and where
  task output belongs unless the user says otherwise.
- Home directory: /home/user.
- Tools available to you:
  - terminal -- run any shell command (install packages, start servers,
    inspect files, run scripts, use curl, etc.).
  - file_editor -- create, view, and edit files (create, view,
    str_replace, insert, undo_edit).
  - browser_navigate, browser_get_state, browser_get_content,
    browser_click, browser_type, browser_scroll -- control a real
    Chromium browser. Its binaries are already installed at
    /home/user/.cache/ms-playwright; you do not need to install a
    browser yourself.
  - think -- a scratchpad tool for extended private reasoning when a
    problem needs it.
  - Any MCP tools exposed to you (e.g. project_info via the
    professor-xmd-tools MCP server) -- call them like any other tool.
- Web research: you do not have a dedicated "web search" tool.
  Research happens in TWO STEPS, and you must do step 1 FIRST:

  STEP 1 -- SEARCH (send a query, read the result LIST):
    browser_navigate(url="{SEARCH_ENGINE_URL}/search?q=!bing+!google+WORD1+WORD2+WORD3")
    then browser_get_content() to read the list of URLs the search returned.
    The URL MUST contain "?q=" followed by your actual search words.
    Without "?q=" the engine returns its HOMEPAGE, not search results.

  STEP 2 -- VISIT (open ONE specific result URL):
    Pick a URL from the search result list, then
    browser_navigate(url="<that specific result URL>"),
    then browser_get_content() to read that page.

  CRITICAL RULES:
  * {SEARCH_ENGINE_URL} WITHOUT "?q=..." is the search engine's homepage.
    Opening it is NOT searching. It shows nothing useful.
  * NEVER open {SEARCH_ENGINE_URL} as if it were the target website.
    It is a TOOL for finding other websites, not a destination.
  * If browser_get_content() on a search page returns no <article class="result"> entries,
    the query was wrong (missing "?q=" or wrong engine modifiers) -- fix the URL and retry.
  * If SearXNG returns nothing or errors, wait a moment and RETRY the same
    two-step search — the instance sleeps sometimes and needs up to ~1 min
    to wake. NEVER fall back to duckduckgo.com, google.com or any other
    search engine directly; the company search engine is the only allowed one.

- BROWSER TOOL USAGE (critical):
  * The browser uses an INDEXED-DOM model, not CSS selectors.
  * To click/type, FIRST call browser_get_state() to see the
    numbered interactive elements on the page.
  * browser_click(index=N) -- where N is from browser_get_state.
  * browser_type(index=N, text="...") -- same N source.
  * NEVER guess indexes or use CSS selectors like '#email'.
  * After every click/type/scroll, call browser_get_state() again --
    indexes change with every navigation, scroll, or DOM update.
  * browser_scroll(direction="down") -- only up/down, no amount.
  * Screenshots are diagnostic only: browser_get_state with
    include_screenshot=true. Use it when text state is insufficient.
  * No coordinate-based actions exist. If an element is not visible,
    scroll or navigate -- never guess pixel positions.
- You are free to install packages, copy files, run background
  processes, and start local servers from the terminal whenever the
  task calls for it.

You are a fully autonomous agent with these capabilities available to
you at all times. Decide for yourself which tools to use, in what order,
and when a task is actually complete.
""".strip()


EVENT_FILE = Path("/tmp/openhands-events.jsonl")
DONE_FILE = Path("/tmp/openhands-done")


def emit(record):
    with EVENT_FILE.open("a", encoding="utf-8") as f:
        f.write(
            json.dumps(
                record,
                ensure_ascii=False,
                default=str,
            )
            + "\n"
        )
        f.flush()


def analyze_screenshot_with_qwen(screenshot_b64: str, question: str = "Describe this image in detail: layout, colors, dimensions, positioning, text, and any visual issues.") -> str:
    """Send screenshot to Groq Qwen 3.6-27b for vision analysis."""
    import urllib.request

    api_key = os.environ.get("VISION_API_KEY", "")
    model = os.environ.get("VISION_MODEL", "qwen/qwen3.6-27b")
    base_url = os.environ.get("VISION_BASE_URL", "https://api.groq.com/openai/v1")

    if not api_key:
        return "[vision-unavailable: no VISION_API_KEY]"

    # Ensure data URL prefix
    if not screenshot_b64.startswith("data:image"):
        if screenshot_b64.startswith("iVBOR"):
            screenshot_b64 = "data:image/png;base64," + screenshot_b64
        else:
            screenshot_b64 = "data:image/png;base64," + screenshot_b64

    body = {
        "model": model,
        "max_tokens": 4000,
        "temperature": 0.3,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": screenshot_b64}},
            ],
        }],
    }

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Strip <think>...</think> if present — extract answer
        import re
        # Remove think blocks
        cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        # If think was in content but no </think> (truncated), take everything after <think> ends
        if not cleaned and "<think>" in content:
            cleaned = content.split("<think>")[-1].strip()
        # Strip newlines
        return cleaned or content or "[empty-analysis]"

    except Exception as exc:
        return f"[vision-error: {str(exc)[:200]}]"


class LiveVisualizer(ConversationVisualizerBase):
    def on_event(self, event: Event) -> None:
        try:
            data = event.model_dump(
                mode="json",
                exclude_none=True,
            )
        except Exception:
            data = {
                "text": str(event),
            }

        event_name = type(event).__name__

        # ============================================================
        # VISION INJECTION: If ObservationEvent has screenshot_data,
        # call Qwen and append analysis to content
        # ============================================================
        if event_name == "ObservationEvent":
            obs = data.get("observation") or {}
            screenshot_data = obs.get("screenshot_data")
            if screenshot_data:
                print("[VISION] Analyzing screenshot with Qwen...", flush=True)
                analysis = analyze_screenshot_with_qwen(screenshot_data)
                print("[VISION] Analysis length:", len(analysis), flush=True)

                # Append analysis as a new content block
                content = obs.get("content") or []
                if isinstance(content, list):
                    content.append({
                        "cache_prompt": False,
                        "type": "text",
                        "text": "\n\n=== VISUAL ANALYSIS (Qwen 3.6-27b) ===\n" + analysis,
                    })
                    obs["content"] = content
                    data["observation"] = obs

        record = {
            "event_type": event_name,
            "data": data,
        }

        print(
            "__PX_EVENT__" + json.dumps(
                record,
                ensure_ascii=False,
                default=str,
            ),
            flush=True,
        )

        emit(record)


def main():
    EVENT_FILE.write_text("", encoding="utf-8")
    DONE_FILE.unlink(missing_ok=True)

    try:
        llm = LLM(
            usage_id="professor-xmd-live",
            model=os.environ["LLM_MODEL"],
            api_key=SecretStr(os.environ["LLM_API_KEY"]),
            base_url=os.environ["LLM_BASE_URL"],
        )

        mcp_config = {
            "professor-xmd-tools": {
                "command": "node",
                "args": ["/code/mcp/server.js"],
            }
        }

        agent_context = AgentContext(
            system_message_suffix=SELF_AWARENESS_PROMPT,
            load_project_skills=True,
            load_user_skills=True,
            load_memory=True,
        )

        agent = Agent(
            llm=llm,
            tools=[
                Tool(name=TerminalTool.name),
                Tool(name=FileEditorTool.name),
                Tool(name=BrowserToolSet.name),
            ],
            mcp_config=mcp_config,
            tool_concurrency_limit=1,
            agent_context=agent_context,
        )

        conversation = Conversation(
            agent=agent,
            workspace="/code/project",
            visualizer=LiveVisualizer(),
            max_iteration_per_run=1000,
        )
        conversation.send_message(
            os.environ["USER_TASK"]
        )

        conversation.run()

        emit({
            "event_type": "OpenHandsRunFinished",
            "data": {
                "status": "success",
            },
        })

    except Exception:
        error_text = traceback.format_exc()

        emit({
            "event_type": "OpenHandsRunError",
            "data": {
                "error": error_text,
            },
        })

        raise

    finally:
        DONE_FILE.write_text(
            "done",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
`;

// ============================================================
// PERSISTENT CLOUD SANDBOX — CONNECT OR CREATE
// ============================================================

type PersistentSandbox = Awaited<
  ReturnType<typeof Sandbox.create>
>;

type SandboxState = {
  sandboxId: string;
};

const RUNTIME_DIR = path.join(
  process.cwd(),
  ".runtime",
);

const SANDBOX_STATE_FILE = path.join(
  RUNTIME_DIR,
  "sandbox.json",
);

let persistentSandbox: PersistentSandbox | null = null;

let sandboxSetupPromise:
  Promise<PersistentSandbox> | null = null;

function loadSandboxState(): SandboxState | null {
  try {
    if (!fs.existsSync(SANDBOX_STATE_FILE)) {
      return null;
    }

    const raw = fs.readFileSync(
      SANDBOX_STATE_FILE,
      "utf-8",
    );

    const data = JSON.parse(raw);

    if (
      !data ||
      typeof data.sandboxId !== "string" ||
      !data.sandboxId.trim()
    ) {
      return null;
    }

    return {
      sandboxId: data.sandboxId.trim(),
    };
  } catch {
    return null;
  }
}

function saveSandboxState(
  sandboxId: string,
) {
  fs.mkdirSync(
    RUNTIME_DIR,
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    SANDBOX_STATE_FILE,
    JSON.stringify(
      {
        sandboxId,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  console.log(
    `💾 E2B sandbox ID saved: ${sandboxId}`,
  );
}

function clearSandboxState() {
  try {
    if (fs.existsSync(SANDBOX_STATE_FILE)) {
      fs.unlinkSync(SANDBOX_STATE_FILE);
    }
  } catch {
    // ignore
  }
}

async function connectExistingSandbox(
  sandboxId: string,
): Promise<PersistentSandbox | null> {
  try {
    console.log(
      `🔌 Connecting to saved E2B sandbox: ${sandboxId}`,
    );

    const sandbox =
      await Sandbox.connect(
        sandboxId,
        { timeoutMs: 1800000 } as any,
      );

    console.log(
      `♻️ Existing E2B sandbox connected: ${sandbox.sandboxId}`,
    );

    return sandbox;
  } catch (error) {
    console.warn(
      `⚠️ Could not connect to sandbox ${sandboxId}.`,
      error instanceof Error
        ? error.message
        : String(error),
    );

    return null;
  }
}

async function createNewSandbox(): Promise<PersistentSandbox> {
  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= 5;
    attempt++
  ) {
    try {
      console.log(
        `🛰️ E2B create attempt ${attempt}/5`,
      );

      const sandbox =
        await Sandbox.create({
          template: "professor-xmd-browser-v3",
          timeoutMs: 1800000,
          lifecycle: {
            onTimeout: "pause",
            autoResume: true,
          },
        } as any);

      console.log(
        `✅ New E2B sandbox created: ${sandbox.sandboxId}`,
      );

      return sandbox;
    } catch (error) {
      lastError = error;

      console.error(
        `⚠️ E2B create failed attempt ${attempt}/5`,
        error,
      );

      if (attempt < 5) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              attempt * 2000,
            ),
        );
      }
    }
  }

  throw new Error(
    "E2B sandbox creation failed after 5 attempts: " +
      (
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
      ),
  );
}

async function getPersistentSandbox(): Promise<PersistentSandbox> {
  if (persistentSandbox) {
    return persistentSandbox;
  }

  if (sandboxSetupPromise) {
    return sandboxSetupPromise;
  }

  sandboxSetupPromise =
    (async () => {
      // ======================================================
      // 1. TRY SAVED SANDBOX
      // ======================================================

      const saved =
        loadSandboxState();

      if (saved?.sandboxId) {
        const existing =
          await connectExistingSandbox(
            saved.sandboxId,
          );

        if (existing) {
          persistentSandbox =
            existing;

          console.log(
            `✅ Reusing saved sandbox: ${existing.sandboxId}`,
          );

          return existing;
        }

        console.log(
          "⚠️ Saved sandbox unavailable. Creating replacement.",
        );

        clearSandboxState();
      }

      // ======================================================
      // 2. CREATE NEW SANDBOX
      // ======================================================

      const sandbox =
        await createNewSandbox();

      // ======================================================
      // 3. SAVE ID
      // ======================================================

      saveSandboxState(
        sandbox.sandboxId,
      );

      // ======================================================
      // 4. PREPARE WORKSPACE
      // ======================================================

      await sandbox.commands.run(
        "mkdir -p /code/project /code/mcp",
      );

      // ======================================================
      // 5. MCP SETUP — NEW SANDBOX ONLY
      // ======================================================

      await sandbox.commands.run(
        "if [ ! -f /code/mcp/package.json ]; then " +
          "cd /code/mcp && " +
          "npm init -y >/dev/null 2>&1 && " +
          "npm pkg set type=module && " +
          "npm install @modelcontextprotocol/server zod; " +
        "fi",
        {
          timeoutMs: 180000,
        },
      );

      const mcpEncoded =
        Buffer
          .from(MCP_SERVER)
          .toString("base64");

      await sandbox.commands.run(
        `echo ${mcpEncoded} | base64 -d > /code/mcp/server.js`,
      );

      // ======================================================
      // 6. OPENHANDS SETUP — NEW SANDBOX ONLY
      // ======================================================

      await sandbox.commands.run(
        "test -x /code/openhands-venv/bin/python && echo VENV_OK || echo VENV_MISSING",
        {
          timeoutMs: 900000,
        },
      );

      const agentEncoded =
        Buffer
          .from(OPENHANDS_AGENT)
          .toString("base64");

      await sandbox.commands.run(
        `echo ${agentEncoded} | base64 -d > /code/agent.py`,
      );

      // ======================================================
      // 7. VERIFY
      // ======================================================

      const compileCheck =
        await sandbox.commands.run(
          "/code/openhands-venv/bin/python " +
            "-m py_compile /code/agent.py",
        );

      if (
        compileCheck.exitCode !== 0
      ) {
        throw new Error(
          "agent.py syntax check failed:\n" +
            String(
              compileCheck.stderr ??
                compileCheck.stdout ??
                "",
            ),
        );
      }

      persistentSandbox =
        sandbox;

      console.log(
        `✅ OpenHands + MCP ready: ${sandbox.sandboxId}`,
      );

      return sandbox;
    })();

  try {
    return await sandboxSetupPromise;
  } finally {
    if (persistentSandbox) {
      sandboxSetupPromise = null;
    }
  }
}

async function prepareSandbox() {
  return getPersistentSandbox();
}
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "professor-xmd-ag-ui",
  });
});


app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  globalClients.add(res);

  res.on("close", () => {
    globalClients.delete(res);
  });
});

app.post(
  "/",
  async (
    req,
    res,
  ) => {
    const input =
      req.body as RunInput;

    const threadId =
      input.threadId ??
      randomUUID();

    const runId =
      input.runId ??
      randomUUID();

    const task =
      getUserTask(input);

    if (!task) {
      res.status(400);

      res.json({
        error:
          "No user message supplied.",
      });

      return;
    }

    /*
     * New run must not collide with an
     * existing persisted run.
     */
    const existing =
      loadRun(runId);

    if (existing) {
      res.status(409);

      res.json({
        error:
          "Run already exists.",
        runId,
      });

      return;
    }

    const now =
      new Date().toISOString();

    const run: PersistedRun = {
      threadId,
      runId,
      task,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    saveRun(run);

    /*
     * Open SSE connection.
     */
    res.setHeader(
      "Content-Type",
      "text/event-stream",
    );

    res.setHeader(
      "Cache-Control",
      "no-cache",
    );

    res.setHeader(
      "Connection",
      "keep-alive",
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no",
    );

    res.flushHeaders?.();

    /*
     * Remember which run this response belongs to.
     */
    (res as any).__professorXmdRunId =
      runId;

    addRunClient(
      runId,
      res,
    );

    /*
     * IMPORTANT:
     *
     * Browser disconnect does NOT cancel
     * executeBackgroundRun().
     *
     * We only remove this SSE client.
     */
    res.on("close", () => {
      removeRunClient(
        runId,
        res,
      );
    });

    /*
     * Send RUN_STARTED immediately.
     */
    sendEvent(
      res,
      {
        type:
          "RUN_STARTED",
        threadId,
        runId,
      },
    );

    console.log(
      `\n🧑 BACKGROUND TASK [${runId}]: ${task}`,
    );

    /*
     * CRITICAL:
     *
     * Do NOT await this.
     *
     * The browser request and the agent
     * execution are now independent.
     */
    void executeBackgroundRun(
      run,
    );
  },
);

async function executeBackgroundRun(
  run: PersistedRun,
) {
  const {
    runId,
    threadId,
    task,
  } = run;

  /*
   * Dummy response object is used only as a
   * compatibility fallback for sendEvent().
   *
   * Real connected clients are taken from
   * runClients.
   */
  const detachedResponse =
    {
      writableEnded: true,
      destroyed: true,
    } as unknown as express.Response;

  try {
    const sandbox =
      await prepareSandbox();

    run.sandboxId =
      sandbox.sandboxId;

    run.updatedAt =
      new Date().toISOString();

    saveRun(run);

    /*
     * Send system state to currently connected clients.
     */
    appendRunEvent(
      runId,
      {
        type:
          "TEXT_MESSAGE_START",
        messageId:
          `${runId}-system`,
        role:
          "assistant",
      },
    );

    appendRunEvent(
      runId,
      {
        type:
          "TEXT_MESSAGE_CONTENT",
        messageId:
          `${runId}-system`,
        delta:
          `Sandbox ${sandbox.sandboxId} ready. Starting OpenHands...`,
      },
    );

    appendRunEvent(
      runId,
      {
        type:
          "TEXT_MESSAGE_END",
        messageId:
          `${runId}-system`,
      },
    );

    /*
     * Broadcast persisted system events.
     */
    const clients =
      runClients.get(runId);

    for (
      const event of readRunEvents(runId).slice(-3)
    ) {
      if (!clients) {
        break;
      }

      for (
        const client of [...clients]
      ) {
        writeSse(
          client,
          event,
        );
      }
    }

    /*
     * Verify generated agent file.
     */
    const compileCheck =
      await sandbox.commands.run(
        "/code/openhands-venv/bin/python " +
        "-m py_compile /code/agent.py",
      );

    if (
      compileCheck.exitCode !== 0
    ) {
      throw new Error(
        "agent.py syntax check failed:\n" +
        String(
          compileCheck.stderr ??
          compileCheck.stdout ??
          "",
        ),
      );
    }

    /*
     * Reset event transport files.
     */
    await sandbox.commands.run(
      "rm -f " +
      "/tmp/openhands-stream.log " +
      "/tmp/openhands-events.jsonl " +
      "/tmp/openhands-done",
    );

    /*
     * Start OpenHands in the E2B sandbox.
     * This is the real background agent.
     */
    await sandbox.commands.run(
      "/bin/sh -c 'nohup " +
      "/code/openhands-venv/bin/python /code/agent.py " +
      "> /tmp/openhands-stream.log 2>&1 < /dev/null &'",
      {
        envs: {
          LLM_API_KEY: LLM_API_KEY!,
          LLM_MODEL,
          LLM_BASE_URL,
          USER_TASK: task,
          HOME: "/home/user",
          PLAYWRIGHT_BROWSERS_PATH: "/home/user/.cache/ms-playwright",
          SEARCH_ENGINE_URL,
          VISION_API_KEY: process.env.VISION_API_KEY ?? "",
          VISION_MODEL: process.env.VISION_MODEL ?? "",
          VISION_BASE_URL: process.env.VISION_BASE_URL ?? "",
        },
      },
    );

    console.log(
      `🤖 OpenHands started [${runId}]`,
    );

    let offset = 0;
    let done = false;

    console.log(`⏳ Event loop inaanza [${runId}]`);

    while (!done) {
      let raw = "";

      try {
        raw = String(
          await sandbox.files.read(
            "/tmp/openhands-events.jsonl",
          ),
        );
        console.log(`🔍 events read: len=${raw.length}, first30=${JSON.stringify(raw.slice(0,30))}, offset=${offset}`);

        // E2B files.read inarudisha "ERR: path ..." badala ya throw
        if (
          raw.startsWith("ERR:") ||
          raw.includes("does not exist")
        ) {
          raw = "";
        }
      } catch {
        raw = "";
      }

      if (raw) {
        const lines = raw.split("\n");

        while (offset < lines.length) {
          const line = lines[offset].trim();

          if (!line) {
            offset++;
            continue;
          }

          let record: any;

          try {
            const jsonText =
              line.startsWith("__PX_EVENT__")
                ? line.slice("__PX_EVENT__".length)
                : line;

            record = JSON.parse(jsonText);
          } catch {
            // Line bado inaandikwa (partial). Simamisha loop,
            // next iteration tutaijaribu tena.
            break;
          }

          offset++;

          const eventType = String(record.event_type ?? "");
          const data = record.data ?? {};

          if (eventType === "SystemPromptEvent") {
            continue;
          }

          const genericEvent = {
            type: "CUSTOM",
            name: "OPENHANDS_EVENT",
            value: {
              eventType,
              toolCallId: String(
                data.tool_call_id ??
                  data.action?.tool_call_id ??
                  "",
              ),
              timestamp: String(data.timestamp ?? ""),
              data,
            },
          };

          appendRunEvent(runId, genericEvent);

          const clients = runClients.get(runId);
          if (clients) {
            for (const client of [...clients]) {
              writeSse(client, genericEvent);
            }
          }

          console.log(`📡 ${eventType}`);
        }
      }

      try {
        const marker = await sandbox.files.read(
          "/tmp/openhands-done",
        );
        const markerStr = String(marker);
        console.log(`🔍 done read: ${JSON.stringify(markerStr.slice(0, 60))}`);
        done =
          !markerStr.startsWith("ERR:") &&
          markerStr.trim() === "done";
      } catch {
        done = false;
      }

      if (!done) {
        if (Date.now() % 5000 < 300) {
          try {
            await (sandbox as any).setTimeout?.(1800000);
          } catch {}
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 300),
        );
      }
    }

    /*
     * One authoritative completion event.
     */
    const finishedEvent = {
      type:
        "RUN_FINISHED",
      threadId,
      runId,
    };

    appendRunEvent(
      runId,
      finishedEvent,
    );

    const completedRun =
      loadRun(runId);

    if (completedRun) {
      completedRun.status =
        "completed";

      completedRun.updatedAt =
        new Date().toISOString();

      saveRun(
        completedRun,
      );
    }

    const liveClients =
      runClients.get(
        runId,
      );

    if (liveClients) {
      for (
        const client of [
          ...liveClients,
        ]
      ) {
        writeSse(
          client,
          finishedEvent,
        );

        try {
          if (
            !(client as any).writableEnded
          ) {
            client.end();
          }
        } catch {
          // ignore disconnected client
        }
      }

      runClients.delete(
        runId,
      );
    }

    console.log(
      `✅ RUN FINISHED [${runId}]`,
    );

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `❌ BACKGROUND RUN ERROR [${runId}]`,
      error,
    );

    const failedRun =
      loadRun(runId);

    if (failedRun) {
      failedRun.status =
        "error";

      failedRun.error =
        message;

      failedRun.updatedAt =
        new Date().toISOString();

      saveRun(
        failedRun,
      );
    }

    const errorEvent = {
      type:
        "RUN_ERROR",
      message,
    };

    appendRunEvent(
      runId,
      errorEvent,
    );

    const liveClients =
      runClients.get(
        runId,
      );

    if (liveClients) {
      for (
        const client of [
          ...liveClients,
        ]
      ) {
        writeSse(
          client,
          errorEvent,
        );

        try {
          if (
            !(client as any).writableEnded
          ) {
            client.end();
          }
        } catch {
          // ignore
        }
      }

      runClients.delete(
        runId,
      );
    }
  }
}

/*
 * Persisted run metadata + history.
 */
app.get(
  "/runs/:runId",
  (
    req,
    res,
  ) => {
    const runId =
      req.params.runId;

    const run =
      loadRun(runId);

    if (!run) {
      res.status(404).json({
        error:
          "Run not found",
      });

      return;
    }

    res.json({
      run,
      events:
        readRunEvents(runId),
    });
  },
);

/*
 * Reconnect stream.
 *
 * Browser can leave and later reconnect.
 */
app.get(
  "/runs/:runId/stream",
  (
    req,
    res,
  ) => {
    const runId =
      req.params.runId;

    const run =
      loadRun(runId);

    if (!run) {
      res.status(404).end();

      return;
    }

    res.setHeader(
      "Content-Type",
      "text/event-stream",
    );

    res.setHeader(
      "Cache-Control",
      "no-cache",
    );

    res.setHeader(
      "Connection",
      "keep-alive",
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no",
    );

    res.flushHeaders?.();

    /*
     * Existing events.
     */
    const history =
      readRunEvents(
        runId,
      );

    for (
      const event of history
    ) {
      writeSse(
        res,
        event,
      );
    }

    /*
     * Join live run.
     */
    addRunClient(
      runId,
      res,
    );

    res.on("close", () => {
      removeRunClient(
        runId,
        res,
      );
    });

    /*
     * Finished run:
     * history is enough.
     */
    if (
      run.status ===
        "completed" ||
      run.status ===
        "error"
    ) {
      res.end();
    }
  },
);


app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "========================================",
    );
    console.log(
      "🚀 PROFESSOR-XMD AG-UI BRIDGE",
    );
    console.log(
      "========================================",
    );
    console.log(
      `🌐 http://localhost:${PORT}`,
    );
    console.log(
      "========================================",
    );
  },
);
