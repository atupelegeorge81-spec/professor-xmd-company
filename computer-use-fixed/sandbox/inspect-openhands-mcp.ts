import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function main() {
  const sbx = await Sandbox.create()

  await sbx.commands.run(
    'python3 -m venv /code/openhands-venv'
  )

  await sbx.commands.run(
    '/code/openhands-venv/bin/pip install "openhands-sdk==1.46.0"',
    { timeoutMs: 600000 }
  )

  const result = await sbx.commands.run(
    `/code/openhands-venv/bin/python - <<'PY'
from openhands.sdk import Agent
import inspect

print("=== Agent signature ===")
print(inspect.signature(Agent))

print("\\n=== Agent fields ===")
print(Agent.model_fields.keys())

for name, field in Agent.model_fields.items():
    if "mcp" in name.lower():
        print("\\n=== MCP field ===")
        print(name)
        print(field)
PY`
  )

  console.log(result.stdout)
  console.error(result.stderr)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
