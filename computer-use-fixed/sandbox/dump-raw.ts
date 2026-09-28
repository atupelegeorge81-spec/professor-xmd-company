import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'
import * as fs from 'node:fs'

async function main() {
  const stateFile = '.runtime/sandbox.json'
  if (!fs.existsSync(stateFile)) {
    throw new Error('❌ .runtime/sandbox.json haipo. Start server kwanza.')
  }
  const { sandboxId } = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
  console.log(`🔌 Connecting to sandbox ${sandboxId}...`)
  const sbx = await Sandbox.connect(sandboxId)
  console.log(`✅ Connected\n`)

  await sbx.commands.run('rm -f /tmp/openhands-events.jsonl /tmp/openhands-done /tmp/openhands-stream.log')

  const task = process.argv[2] || 'Create file test.txt with content: hello'

  console.log(`📝 Task: ${task}\n`)
  console.log(`▶️ Starting OpenHands...\n`)

  await sbx.commands.run(
    '/bin/sh -c "/code/openhands-venv/bin/python /code/agent.py > /tmp/openhands-stream.log 2>&1"',
    {
      background: true,
      envs: {
        LLM_API_KEY: process.env.LLM_API_KEY!,
        LLM_MODEL: process.env.LLM_MODEL ?? 'openai/deepseek/deepseek-v4-pro',
        LLM_BASE_URL: process.env.LLM_BASE_URL ?? 'https://api.xkiro.com/v1',
        USER_TASK: task,
      },
    }
  )

  let done = false
  const start = Date.now()
  while (!done && Date.now() - start < 600000) {
    try {
      const marker = await sbx.files.read('/tmp/openhands-done')
      if (marker.trim() === 'done') done = true
    } catch {}
    if (!done) await new Promise(r => setTimeout(r, 2000))
    process.stdout.write('.')
  }
  console.log('\n')

  const events = await sbx.files.read('/tmp/openhands-events.jsonl').catch(() => '')
  const streamLog = await sbx.files.read('/tmp/openhands-stream.log').catch(() => '')

  console.log('='.repeat(70))
  console.log('📊 RAW EVENTS (/tmp/openhands-events.jsonl)')
  console.log('='.repeat(70))
  console.log(events)

  console.log('\n' + '='.repeat(70))
  console.log('📄 STDOUT/STDERR (/tmp/openhands-stream.log)')
  console.log('='.repeat(70))
  console.log(streamLog)
}

main().catch(err => { console.error(err); process.exit(1) })
