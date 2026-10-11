#!/usr/bin/env bash
# cu/setup.sh — R31 · setup ya sandbox ya XMD Computer (inaendeshwa kila run, kabla ya bridge).
# Template professor-xmd-browser-v3 ina: node 20, python 3.12 (venv /code/openhands-venv),
# playwright + Chromium. HII inaongeza: claude-agent-sdk (na CLI yake _bundled) + gh CLI.
# Makosa hayazuili bridge — agent anaripoti UKWELI (kosa = "haikufanyika").
LOG=/tmp/cu-setup.log
say() { echo "[setup] $*"; }

# 1) Agent backend — R51: CU_AGENT_BACKEND=openhands (default) au claude (legacy)
if [ "${CU_AGENT_BACKEND:-openhands}" = "claude" ]; then
  # Claude Agent SDK (python) — wheel inakuja na Claude Code CLI bundled
  if ! /code/openhands-venv/bin/python -c "import claude_agent_sdk" >/dev/null 2>&1; then
    say "pip install claude-agent-sdk..."
    if /code/openhands-venv/bin/pip install -q claude-agent-sdk >>"$LOG" 2>&1; then
      say "claude-agent-sdk ✓"
    else
      say "⚠️ pip imeshindikana — angalia $LOG"
    fi
  else
    say "claude-agent-sdk ipo tayari ✓"
  fi
else
  # OpenHands mode: SDK inakuja na template (probe-imara). Hakuna pip za claude.
  if OPENHANDS_SUPPRESS_BANNER=1 /code/openhands-venv/bin/python -c "import openhands.sdk" >/dev/null 2>&1; then
    say "openhands SDK ✓"
  else
    say "❌ openhands SDK haipo kwenye /code/openhands-venv — bridge itaripoti kosa"
  fi
  # xmd_shot.py (sheria ya screenshots) inahitaji playwright ya PYTHON kwenye venv hiyo
  if ! /code/openhands-venv/bin/python -c "import playwright" >/dev/null 2>&1; then
    say "pip install playwright (python)..."
    if /code/openhands-venv/bin/pip install -q playwright >>"$LOG" 2>&1; then
      say "playwright(py) ✓"
    else
      say "⚠️ playwright(py) haikuwekwa — screenshots zitaripoti 'playwright-missing'"
    fi
  else
    say "playwright(py) ipo tayari ✓"
  fi
fi

# 2) gh CLI (gh repo create inahitajika kwa workflow ya mwisho)
if ! command -v gh >/dev/null 2>&1 && [ ! -x /home/user/.local/bin/gh ]; then
  say "kuweka gh CLI..."
  GH_URL=$(curl -s --max-time 20 https://api.github.com/repos/cli/cli/releases/latest | grep -oE 'https://[^"]+gh_[0-9.]+_linux_amd64\.tar\.gz' | head -1 || true)
  if [ -n "$GH_URL" ]; then
    if curl -sL --max-time 90 "$GH_URL" | tar xz -C /tmp 2>>"$LOG"; then
      mkdir -p /home/user/.local/bin
      cp /tmp/gh_*/bin/gh /home/user/.local/bin/gh && chmod +x /home/user/.local/bin/gh && say "gh ✓"
    else
      say "⚠️ gh haikuwekwa (download imeshindikana)"
    fi
  else
    say "⚠️ URL ya gh haipatikani (mtandao?) — agent ataripoti ukweli"
  fi
else
  say "gh ipo tayari ✓"
fi

# 3) Chromium ya Playwright (inakuja na template)
CHROME=$(ls /home/user/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)
if [ -n "$CHROME" ]; then say "chromium ✓"; else say "⚠️ chromium haipatikani — screenshots hazitawezekana"; fi

say "setup imeisha"
