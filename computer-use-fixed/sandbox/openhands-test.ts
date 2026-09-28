import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  const baseUrl = process.env.LLM_BASE_URL

  if (!apiKey) throw new Error('LLM_API_KEY haijawekwa')
  if (!model) throw new Error('LLM_MODEL haijawekwa')
  if (!baseUrl) throw new Error('LLM_BASE_URL haijawekwa')

  console.log('🚀 Creating E2B Linux sandbox...')

  const sbx = await Sandbox.create({
    timeoutMs: 1800000,
  })

  console.log(`✅ Sandbox: ${sbx.sandboxId}`)

  console.log('📁 Preparing workspace...')

  await sbx.commands.run(
    'rm -rf /code/project && mkdir -p /code/project'
  )

  console.log('🐍 Preparing Python environment...')

  await sbx.commands.run(
    'python3 -m venv /code/openhands-venv'
  )

  console.log('📦 Installing OpenHands SDK + tools...')

  await sbx.commands.run(
    '/code/openhands-venv/bin/python -m pip install --upgrade pip && /code/openhands-venv/bin/pip install "openhands-sdk==1.46.0" "openhands-tools==1.46.0"',
    { timeoutMs: 600000 }
  )

  console.log('✅ OpenHands installed')

  console.log('🔎 Verifying OpenHands import...')

  await sbx.commands.run(
    `/code/openhands-venv/bin/python -c "import openhands.sdk; print('OpenHands import OK')"`
  )

  console.log('🧠 Creating OpenHands agent test...')

  const agentScript = `
import os
from pydantic import SecretStr

from openhands.sdk import LLM, Agent, Conversation, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.terminal import TerminalTool

llm = LLM(
    usage_id="professor-xmd-test",
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
)

conversation.send_message(
    "Create a file named hello.txt in the current workspace. "
    "Write exactly: Hello from PROFESSOR-XMD OpenHands test. "
    "Do not create any other files."
)

conversation.run()

print("OPENHANDS_DONE")
`

  const encoded = Buffer
    .from(agentScript)
    .toString('base64')

  await sbx.commands.run(
    `echo ${encoded} | base64 -d > /code/openhands-test.py`
  )

  console.log('▶️ Running OpenHands agent...')

  const result = await sbx.commands.run(
    '/code/openhands-venv/bin/python /code/openhands-test.py',
    {
      timeoutMs: 600000,
      envs: {
        LLM_API_KEY: apiKey,
        LLM_MODEL: model,
        LLM_BASE_URL: baseUrl,
      },
    }
  )

  console.log('📤 Agent output:')
  console.log(result.stdout)

  if (result.stderr) {
    console.log('⚠️ stderr:')
    console.log(result.stderr)
  }

  console.log('🔍 Verifying hello.txt...')

  const verify = await sbx.commands.run(
    'test -f /code/project/hello.txt && echo "FILE EXISTS" && cat /code/project/hello.txt || echo "FILE NOT FOUND"'
  )

  console.log(verify.stdout)

  console.log('')
  console.log('========================================')
  console.log('🎯 OPENHANDS PHASE 2 TEST COMPLETE')
  console.log('========================================')
}

main().catch((error) => {
  console.error('❌ OpenHands test failed:')
  console.error(error)
  process.exit(1)
})
