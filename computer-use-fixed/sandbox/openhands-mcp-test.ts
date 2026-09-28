import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  const baseUrl = process.env.LLM_BASE_URL

  if (!apiKey) throw new Error('LLM_API_KEY haijawekwa')
  if (!model) throw new Error('LLM_MODEL haijawekwa')
  if (!baseUrl) throw new Error('LLM_BASE_URL haijawekwa')

  console.log('🚀 Creating E2B sandbox...')

  const sbx = await Sandbox.create({
    timeoutMs: 1800000,
  })

  console.log(`✅ Sandbox: ${sbx.sandboxId}`)

  await sbx.commands.run(
    'rm -rf /code/project /code/mcp /code/openhands-venv && mkdir -p /code/project /code/mcp'
  )

  console.log('🔌 Preparing MCP server...')

  await sbx.commands.run(
    'cd /code/mcp && npm init -y && npm pkg set type=module && npm install @modelcontextprotocol/server zod',
    { timeoutMs: 180000 }
  )

  const mcpServer = `
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'

const server = new McpServer({
  name: 'professor-xmd-tools',
  version: '1.0.0',
})

server.registerTool(
  'project_info',
  {
    description: 'Returns information about the current PROFESSOR-XMD test workspace.',
    inputSchema: z.object({}),
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          project: 'PROFESSOR-XMD',
          environment: 'computer-use',
          status: 'ready',
        }),
      },
    ],
  }),
)

serveStdio(() => server)
`

  const encodedMcp = Buffer.from(mcpServer).toString('base64')

  await sbx.commands.run(
    `echo ${encodedMcp} | base64 -d > /code/mcp/server.js`
  )

  console.log('✅ MCP server prepared')

  console.log('🐍 Preparing OpenHands...')

  await sbx.commands.run(
    'python3 -m venv /code/openhands-venv',
    { timeoutMs: 120000 }
  )

  await sbx.commands.run(
    '/code/openhands-venv/bin/pip install --upgrade pip && /code/openhands-venv/bin/pip install "openhands-sdk==1.46.0" "openhands-tools==1.46.0"',
    { timeoutMs: 600000 }
  )

  console.log('✅ OpenHands installed')

  const agentScript = `
import os
from pydantic import SecretStr

from openhands.sdk import LLM, Agent, Conversation, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.terminal import TerminalTool

llm = LLM(
    usage_id="professor-xmd-mcp-test",
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

agent = Agent(
    llm=llm,
    tools=[
        Tool(name=TerminalTool.name),
        Tool(name=FileEditorTool.name),
    ],
    mcp_config=mcp_config,
)

conversation = Conversation(
    agent=agent,
    workspace="/code/project",
)

conversation.send_message(
    "You have native OpenHands tools and an MCP server. "
    "First, call the MCP tool project_info and inspect its result. "
    "Then create /code/project/hello.txt using the file editor. "
    "Write exactly: Hello from PROFESSOR-XMD OpenHands MCP test. "
    "Then use the terminal to run "
    "cat /code/project/hello.txt and verify the content. "
    "Do not create any other files."
)

conversation.run()

print("OPENHANDS_MCP_DONE")
`

  const encodedAgent = Buffer.from(agentScript).toString('base64')

  await sbx.commands.run(
    `echo ${encodedAgent} | base64 -d > /code/agent-test.py`
  )

  console.log('🤖 Running OpenHands Agent...')

  const result = await sbx.commands.run(
    '/code/openhands-venv/bin/python /code/agent-test.py',
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

  console.log('🔍 Final verification...')

  const verify = await sbx.commands.run(
    'test -f /code/project/hello.txt && echo "✅ FILE EXISTS" && cat /code/project/hello.txt || echo "❌ FILE NOT FOUND"'
  )

  console.log(verify.stdout)

  console.log('========================================')
  console.log('🎯 OPENHANDS + MCP INTEGRATION TEST')
  console.log('========================================')
}

main().catch(error => {
  console.error('❌ Integration test failed:')
  console.error(error)
  process.exit(1)
})
