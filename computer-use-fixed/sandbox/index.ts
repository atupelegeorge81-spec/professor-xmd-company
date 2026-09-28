import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  console.log('🚀 Creating E2B Sandbox...')

  const sbx = await Sandbox.create()

  console.log('✅ Sandbox created')
  console.log('🆔 Sandbox ID:', sbx.sandboxId)

  console.log('📁 Preparing /code/project...')

  await sbx.commands.run(
    'rm -rf /code/project && mkdir -p /code/project'
  )

  console.log('⚛️ Creating Next.js project...')

  await sbx.commands.run(
    'cd /code/project && npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --use-npm --import-alias "@/*" --no-turbopack',
    { timeoutMs: 180000 }
  )

  console.log('📦 Installing dependencies...')

  await sbx.commands.run(
    'cd /code/project && npm install',
    { timeoutMs: 180000 }
  )

  console.log('🌐 Starting Next.js dev server...')

  await sbx.commands.run(
    'cd /code/project && nohup npm run dev -- --hostname 0.0.0.0 > /tmp/next.log 2>&1 &',
    { timeoutMs: 10000 }
  )

  console.log('⏳ Waiting for Next.js...')

  await new Promise(resolve => setTimeout(resolve, 8000))

  console.log('🔎 Checking server...')

  const log = await sbx.commands.run(
    'cat /tmp/next.log'
  )

  console.log(log.stdout)

  const host = await sbx.getHost(3000)

  console.log('')
  console.log('======================================')
  console.log('🎉 WEBSITE PREVIEW READY')
  console.log('======================================')
  console.log(`🌍 Preview URL: https://${host}`)
  console.log('======================================')
}

main().catch((error) => {
  console.error('❌ Phase 2 failed:')
  console.error(error)
  process.exit(1)
})
