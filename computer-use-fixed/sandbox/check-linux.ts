import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  const sbx = await Sandbox.create()

  const result = await sbx.commands.run(
    'uname -a && cat /etc/os-release | head -5 && python3 --version && node --version'
  )

  console.log(result.stdout)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
