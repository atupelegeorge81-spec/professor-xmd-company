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
