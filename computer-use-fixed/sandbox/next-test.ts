import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  console.log('🚀 Creating E2B sandbox...')

  const sbx = await Sandbox.create()

  console.log('✅ Sandbox:', sbx.sandboxId)

  console.log('📁 Creating Next.js project...')

  await sbx.commands.run(
    'rm -rf /code/project && mkdir -p /code/project'
  )

  await sbx.commands.run(
    'cd /code/project && npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --use-npm --import-alias "@/*" --no-turbopack',
    { timeoutMs: 180000 }
  )

  console.log('✅ Next.js project created')

  console.log('📦 Installing dependencies...')

  await sbx.commands.run(
    'cd /code/project && npm install',
    { timeoutMs: 180000 }
  )

  console.log('✅ Dependencies installed')

  console.log('🌐 Starting Next.js in background...')

  const server = await sbx.commands.run(
    'cd /code/project && npm run dev -- --hostname 0.0.0.0',
    {
      background: true
    }
  )

  console.log('✅ Next.js process started')
  console.log('🆔 Process PID:', server.pid)

  console.log('⏳ Waiting for server...')

  let ready = false

  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000))

    const check = await sbx.commands.run(
      'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000'
    )

    if (check.stdout.trim() === '200') {
      ready = true
      break
    }
  }

  if (!ready) {
    console.log('❌ Next.js did not become ready.')

    const log = await sbx.commands.run(
      'ps aux | grep "[n]ext" || true; echo "--- LOG ---"; cat /tmp/next.log 2>/dev/null || true'
    )

    console.log(log.stdout)
    throw new Error('Next.js server is not ready on port 3000')
  }

  const host = sbx.getHost(3000)

  console.log('')
  console.log('========================================')
  console.log('🎉 NEXT.JS PREVIEW READY')
  console.log('========================================')
  console.log(`🌍 https://${host}`)
  console.log('========================================')
}

main().catch(error => {
  console.error('❌ Next.js test failed:')
  console.error(error)
  process.exit(1)
})
