#!/usr/bin/env bash
set -e

PROJECT="$HOME/computer-use-v2"
OUT="$HOME/Downloads"
STAMP=$(date +%Y%m%d_%H%M%S)
STAGE="$HOME/.cache/agent-stage-$STAMP"
ZIP="$OUT/professor-xmd-for-agent_$STAMP.zip"

mkdir -p "$OUT" "$STAGE"

# Backend
mkdir -p "$STAGE/backend"
cp "$PROJECT/server.ts"             "$STAGE/backend/" 2>/dev/null || true
cp "$PROJECT/README_FOR_AGENT.md"   "$STAGE/"        2>/dev/null || true

# Frontend
mkdir -p "$STAGE/frontend/src"
cp "$PROJECT/copilotkit/package.json"        "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/vite.config.ts"      "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/tsconfig.json"       "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/tsconfig.app.json"   "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/index.html"          "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/src/App.tsx"                  "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/App.css"                  "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/index.css"                "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/main.tsx"                 "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/openhands-adapter.ts"     "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/openhands-to-messages.ts" "$STAGE/frontend/src/" 2>/dev/null || true
cp "$PROJECT/copilotkit/src/ActivityCard.tsx"         "$STAGE/frontend/src/" 2>/dev/null || true

# Agent Elements (reference)
AE="$PROJECT/copilotkit/src/components/agent-elements"
mkdir -p "$STAGE/agent-elements-ref"
cp -r "$AE/"* "$STAGE/agent-elements-ref/" 2>/dev/null || true

# Sample events
mkdir -p "$STAGE/sample-events"
LATEST=$(ls -t "$PROJECT/.runtime/runs/"*.events.jsonl 2>/dev/null | head -1 || true)
if [ -n "$LATEST" ]; then
  cp "$LATEST" "$STAGE/sample-events/openhands-events.jsonl" 2>/dev/null || true
fi

# Zip
cd "$STAGE"
zip -r "$ZIP" . -x "*.DS_Store" > /dev/null
cd "$HOME"
rm -rf "$STAGE"

echo ""
echo "✅ ZIP imeundwa:"
echo "   $ZIP"
ls -lh "$ZIP"
