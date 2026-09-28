import { Template, waitForTimeout } from 'e2b';

const PATCH_SCRIPT = `
import os
path = "/code/openhands-venv/lib/python3.12/site-packages/openhands/tools/browser_use/impl.py"
with open(path) as f:
    src = f.read()

old = """        result_json = await self._server._get_browser_state(include_screenshot)

        if include_screenshot:
            try:
                result_data = json.loads(result_json)
                screenshot_data = result_data.pop("screenshot", None)
"""

new = """        result_raw = await self._server._get_browser_state(include_screenshot)

        if isinstance(result_raw, tuple):
            result_json, _patch_screenshot = result_raw
        else:
            result_json = result_raw
            _patch_screenshot = None

        if include_screenshot:
            try:
                result_data = json.loads(result_json)
                screenshot_data = _patch_screenshot or result_data.pop("screenshot", None)
"""

if old in src:
    src = src.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(src)
    print("PATCHED")
else:
    print("ALREADY_PATCHED_OR_NOT_FOUND")
`;

export const template = Template()
  .fromImage('python:3.12-slim')
  .setUser('root')
  .aptInstall([
    'curl', 'wget', 'git', 'ca-certificates', 'xz-utils', 'gnupg',
    'libnss3', 'libnspr4', 'libatk1.0-0', 'libatk-bridge2.0-0',
    'libcups2', 'libdrm2', 'libxkbcommon0', 'libxcomposite1',
    'libxdamage1', 'libxfixes3', 'libxrandr2', 'libgbm1',
    'libpango-1.0-0', 'libcairo2', 'libasound2', 'libatspi2.0-0',
    'fonts-liberation', 'fonts-noto-color-emoji',
    'build-essential', 'pkg-config',
  ])
  .runCmd(
    'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && ' +
    'apt-get install -y nodejs',
  )
  .runCmd('mkdir -p /code/project /code/mcp /home/user/.cache /home/user/.config')
  .runCmd('chown -R 1000:1000 /code /home/user')
  .runCmd('npm install -g playwright')
  .runCmd('npx playwright install-deps chromium')
  .setUser('user')
  .setWorkdir('/home/user')
  .setEnvs({
    HOME: '/home/user',
    PLAYWRIGHT_BROWSERS_PATH: '/home/user/.cache/ms-playwright',
  })
  .runCmd('npx playwright install chromium')
  .runCmd('python3 -m venv /code/openhands-venv')
  .runCmd('/code/openhands-venv/bin/pip install --upgrade pip')
  .runCmd(
    '/code/openhands-venv/bin/pip install ' +
    '"openhands-sdk==1.46.0" "openhands-tools==1.46.0" playwright',
  )
  // PATCH: Fix browser_get_state tuple bug
  .runCmd(`echo '${Buffer.from(PATCH_SCRIPT).toString('base64')}' | base64 -d > /tmp/patch.py && /code/openhands-venv/bin/python /tmp/patch.py`)
  .setWorkdir('/code')
  .setEnvs({
    PATH: '/code/openhands-venv/bin:/usr/local/bin:/usr/bin:/bin',
    HOME: '/home/user',
    PLAYWRIGHT_BROWSERS_PATH: '/home/user/.cache/ms-playwright',
  })
  .setStartCmd('echo "PROFESSOR-XMD ready"', waitForTimeout(3000));
