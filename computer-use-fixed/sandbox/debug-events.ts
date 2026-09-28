import "dotenv/config";
import { Sandbox } from "@e2b/code-interpreter";

async function main() {
  const apiKey = process.env.LLM_API_KEY!;
  const model = process.env.LLM_MODEL!;
  const baseUrl = process.env.LLM_BASE_URL!;

  const sbx = await Sandbox.create({
    timeoutMs: 1800000,
  });

  await sbx.commands.run(
    "rm -rf /code/project /code/openhands-venv && mkdir -p /code/project"
  );

  await sbx.commands.run(
    "python3 -m venv /code/openhands-venv && " +
    "/code/openhands-venv/bin/pip install " +
    "\"openhands-sdk==1.46.0\" \"openhands-tools==1.46.0\"",
    { timeoutMs: 600000 }
  );

  const script = String.raw`
import os
import json

from pydantic import SecretStr

from openhands.sdk import LLM, Agent, Conversation, Tool
from openhands.sdk.conversation import ConversationVisualizerBase
from openhands.sdk.event import Event
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.terminal import TerminalTool

EVENT_FILE = "/tmp/openhands-events.jsonl"

def emit(event):
    with open(EVENT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "type": type(event).__name__,
            "data": event.model_dump(mode="json", exclude_none=True)
        }, ensure_ascii=False, default=str) + "\\n")
        f.flush()

class DebugVisualizer(ConversationVisualizerBase):
    def on_event(self, event: Event):
        print("EVENT:", type(event).__name__, flush=True)
        emit(event)

llm = LLM(
    usage_id="professor-xmd-debug",
    model=os.environ["LLM_MODEL"],
    api_key=SecretStr(os.environ["LLM_API_KEY"]),
    base_url=os.environ["LLM_BASE_URL"],
)

agent = Agent(
    llm=llm,
    tools=[
        Tool(name=TerminalTool.name),
        Tool(name=FileEditorTool.name),
    ],
)

conversation = Conversation(
    agent=agent,
    workspace="/code/project",
    visualizer=DebugVisualizer(),
)

conversation.send_message(
    "Create /code/project/hello.txt and write exactly: DEBUG TEST"
)

conversation.run()

print("DONE", flush=True)
`;

  const encoded = Buffer.from(script).toString("base64");

  await sbx.commands.run(
    `echo ${encoded} | base64 -d > /code/debug.py`
  );

  const result = await sbx.commands.run(
    "/code/openhands-venv/bin/python /code/debug.py",
    {
      timeoutMs: 600000,
      envs: {
        LLM_API_KEY: apiKey,
        LLM_MODEL: model,
        LLM_BASE_URL: baseUrl,
      },
    }
  );

  console.log("===== OPENHANDS STDOUT =====");
  console.log(result.stdout);

  console.log("===== OPENHANDS STDERR =====");
  console.log(result.stderr);

  console.log("===== EVENT FILE =====");

  const events = await sbx.commands.run(
    "cat /tmp/openhands-events.jsonl 2>/dev/null || true"
  );

  console.log(events.stdout);

  console.log("===== FILE CHECK =====");

  const file = await sbx.commands.run(
    "cat /code/project/hello.txt 2>/dev/null || echo FILE_NOT_FOUND"
  );

  console.log(file.stdout);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
