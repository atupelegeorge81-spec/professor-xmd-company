#!/usr/bin/env bash
set -e

PROJECT="$HOME/computer-use-v2"
OUT="$HOME/Downloads"
STAMP=$(date +%Y%m%d_%H%M%S)
STAGE="$HOME/.cache/pxmd-stage-$STAMP"
ZIP="$OUT/professor-xmd-full_$STAMP.zip"

mkdir -p "$OUT" "$STAGE" "$STAGE/backend" "$STAGE/frontend/src" "$STAGE/agent" "$STAGE/sample-events"

# Backend
cp "$PROJECT/server.ts"             "$STAGE/backend/" 2>/dev/null || true
cp "$PROJECT/README_FOR_AGENT.md"   "$STAGE/"        2>/dev/null || true

# Frontend
cp "$PROJECT/copilotkit/package.json"                 "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/vite.config.ts"               "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/tsconfig.json"                "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/tsconfig.app.json"            "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/index.html"                   "$STAGE/frontend/"      2>/dev/null || true
cp "$PROJECT/copilotkit/src/App.tsx"                  "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/App.css"                  "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/index.css"                "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/main.tsx"                 "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/Chat.tsx"                 "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/ScreenshotModal.tsx"      "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/PreviewPanel.tsx"         "$STAGE/frontend/src/"  2>/dev/null || true
cp "$PROJECT/copilotkit/src/openhands-to-timeline.ts" "$STAGE/frontend/src/"  2>/dev/null || true

# Animations
mkdir -p "$STAGE/frontend/src/agent-anim"
cp -r "$PROJECT/copilotkit/src/agent-anim/"* "$STAGE/frontend/src/agent-anim/" 2>/dev/null || true

# Agent
cp "$PROJECT/template.ts"  "$STAGE/agent/" 2>/dev/null || true
cp "$PROJECT/build.ts"     "$STAGE/agent/" 2>/dev/null || true

# Sample events
LATEST=$(ls -t "$PROJECT/.runtime/runs/"*.events.jsonl 2>/dev/null | head -1 || echo "")
[ -n "$LATEST" ] && cp "$LATEST" "$STAGE/sample-events/openhands-events.jsonl" 2>/dev/null || true

# Zip
cd "$STAGE"
zip -r "$ZIP" . -x "*.DS_Store" "*/node_modules/*" "*/dist/*" > /dev/null
cd "$HOME"
rm -rf "$STAGE"

echo ""
echo "✅ ZIP imeundwa: $ZIP"
ls -lh "$ZIP"
echo ""
echo "=== Yaliyomo (kwanza 30) ==="
unzip -l "$ZIP" | head -30
