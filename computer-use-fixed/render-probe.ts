import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

const app = express();

app.use(cors());
app.use(express.json());

function send(res: express.Response, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  (res as any).flush?.();
}

app.post("/", async (_req, res) => {
  const threadId = randomUUID();
  const runId = randomUUID();
  const toolCallId = randomUUID();
  const messageId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  console.log("▶️ RENDER PROBE START");

  send(res, {
    type: "RUN_STARTED",
    threadId,
    runId,
  });

  await new Promise((r) => setTimeout(r, 500));

  console.log("🔵 TOOL START");

  send(res, {
    type: "TOOL_CALL_START",
    toolCallId,
    toolCallName: "create_file",
  });

  await new Promise((r) => setTimeout(r, 500));

  send(res, {
    type: "TOOL_CALL_ARGS",
    toolCallId,
    delta: JSON.stringify({
      path: "/code/project/hello.txt",
      content: "Hello from AG-UI render probe.",
    }),
  });

  await new Promise((r) => setTimeout(r, 500));

  send(res, {
    type: "TOOL_CALL_END",
    toolCallId,
  });

  console.log("🟡 TOOL EXECUTING — WAIT 4s");

  await new Promise((r) => setTimeout(r, 4000));

  console.log("🟢 TOOL RESULT");

  send(res, {
    type: "TOOL_CALL_RESULT",
    toolCallId,
    messageId,
    role: "tool",
    content: JSON.stringify({
      success: true,
      message: "File created successfully.",
      path: "/code/project/hello.txt",
    }),
  });

  await new Promise((r) => setTimeout(r, 500));

  send(res, {
    type: "RUN_FINISHED",
    threadId,
    runId,
  });

  console.log("✅ RENDER PROBE FINISHED");

  res.end();
});

app.listen(8001, "0.0.0.0", () => {
  console.log("========================================");
  console.log("🧪 PROFESSOR-XMD AG-UI RENDER PROBE");
  console.log("🌐 http://localhost:8001");
  console.log("========================================");
});
