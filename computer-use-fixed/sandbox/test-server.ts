import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  console.log('🚀 Creating sandbox...')

  const sbx = await Sandbox.create()

  console.log('✅ Sandbox:', sbx.sandboxId)

  console.log('🌐 Starting simple server...')

  await sbx.commands.run(
    'python3 -m http.server 3000 --directory /code > /tmp/server.log 2>&1 &',
    { timeoutMs: 5000 }
  )

  await new Promise(resolve => setTimeout(resolve, 3000))

  const host = await sbx.getHost(3000)

  console.log('✅ SERVER STARTED')
  console.log(`🌍 Preview: https://${host}`)

  const log = await sbx.commands.run('cat /tmp/server.log')

  console.log(log.stdout)
}

main().catch(error => {
  console.error('❌ Test failed:')
  console.error(error)
  process.exit(1)
})
