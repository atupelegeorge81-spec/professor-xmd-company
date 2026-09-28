import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

async function main() {
  console.log('🔌 Connecting to MCP server...')

  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )

  const tsxCli = path.join(
    root,
    'node_modules',
    'tsx',
    'dist',
    'cli.mjs'
  )

  const mcpServer = path.join(
    root,
    'mcp',
    'src',
    'index.ts'
  )

  const client = new Client({
    name: 'professor-xmd-test-client',
    version: '1.0.0',
  })

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, mcpServer],
  })

  await client.connect(transport)

  console.log('✅ MCP connected')

  const result = await client.listTools()

  console.log('🛠️ Available tools:')
  console.log(JSON.stringify(result.tools, null, 2))

  console.log('\n▶️ Calling project_info...')

  const toolResult = await client.callTool({
    name: 'project_info',
    arguments: {},
  })

  console.log('📤 MCP result:')
  console.log(JSON.stringify(toolResult, null, 2))

  await client.close()

  console.log('\n✅ MCP PHASE 3 BASIC CONNECTION TEST PASSED')
}

main().catch((error) => {
  console.error('❌ MCP test failed:')
  console.error(error)
  process.exit(1)
})
