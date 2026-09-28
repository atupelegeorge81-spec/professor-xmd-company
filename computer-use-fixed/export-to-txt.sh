#!/usr/bin/env bash
set -e

PROJECT="$HOME/computer-use-v2"
OUT="$HOME/Downloads"
STAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="$OUT/professor-xmd-full_$STAMP.txt"

mkdir -p "$OUT"

# ============================================================
# HEADER
# ============================================================
{
echo "======================================================================"
echo "PROFESSOR-XMD — FULL PROJECT EXPORT"
echo "======================================================================"
echo "Generated: $(date)"
echo "Root: $PROJECT"
echo ""
echo "CONTENTS:"
echo "  1. Backend (server.ts)"
echo "  2. Frontend (Chat UI, adapter, App)"
echo "  3. Animations (agent-anim/ — 51 components)"
echo "  4. Agent (template.ts, build.ts)"
echo "  5. Sample events (OpenHands real data)"
echo "  6. README_FOR_AGENT.md"
echo "======================================================================"
echo ""
} > "$OUTFILE"

# ============================================================
# FUNCTION: Append file contents
# ============================================================
append_file() {
  local label="$1"
  local filepath="$2"
  if [ -f "$filepath" ]; then
    echo "" >> "$OUTFILE"
    echo "======================================================================" >> "$OUTFILE"
    echo "FILE: $label" >> "$OUTFILE"
    echo "======================================================================" >> "$OUTFILE"
    cat "$filepath" >> "$OUTFILE"
    echo "" >> "$OUTFILE"
  fi
}

# ============================================================
# 1. README
# ============================================================
append_file "README_FOR_AGENT.md" "$PROJECT/README_FOR_AGENT.md"

# ============================================================
# 2. BACKEND
# ============================================================
append_file "backend/server.ts" "$PROJECT/server.ts"

# ============================================================
# 3. FRONTEND CORE
# ============================================================
append_file "frontend/package.json"        "$PROJECT/copilotkit/package.json"
append_file "frontend/vite.config.ts"      "$PROJECT/copilotkit/vite.config.ts"
append_file "frontend/tsconfig.json"       "$PROJECT/copilotkit/tsconfig.json"
append_file "frontend/tsconfig.app.json"   "$PROJECT/copilotkit/tsconfig.app.json"
append_file "frontend/index.html"          "$PROJECT/copilotkit/index.html"
append_file "frontend/src/App.tsx"                    "$PROJECT/copilotkit/src/App.tsx"
append_file "frontend/src/App.css"                    "$PROJECT/copilotkit/src/App.css"
append_file "frontend/src/index.css"                  "$PROJECT/copilotkit/src/index.css"
append_file "frontend/src/main.tsx"                   "$PROJECT/copilotkit/src/main.tsx"
append_file "frontend/src/Chat.tsx"                   "$PROJECT/copilotkit/src/Chat.tsx"
append_file "frontend/src/ScreenshotModal.tsx"        "$PROJECT/copilotkit/src/ScreenshotModal.tsx"
append_file "frontend/src/PreviewPanel.tsx"           "$PROJECT/copilotkit/src/PreviewPanel.tsx"
append_file "frontend/src/openhands-to-timeline.ts"   "$PROJECT/copilotkit/src/openhands-to-timeline.ts"

# ============================================================
# 4. ANIMATIONS (agent-anim/ — recursively)
# ============================================================
AGENT_ANIM="$PROJECT/copilotkit/src/agent-anim"
if [ -d "$AGENT_ANIM" ]; then
  while IFS= read -r f; do
    rel="${f#$AGENT_ANIM/}"
    append_file "frontend/src/agent-anim/$rel" "$f"
  done < <(find "$AGENT_ANIM" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) | sort)
fi

# ============================================================
# 5. AGENT
# ============================================================
append_file "agent/template.ts" "$PROJECT/template.ts"
append_file "agent/build.ts"    "$PROJECT/build.ts"

# ============================================================
# 4. SAMPLE EVENTS
# ============================================================
LATEST=$(ls -t "$PROJECT/.runtime/runs/"*.events.jsonl 2>/dev/null | head -1 || echo "")
[ -n "$LATEST" ] && append_file "sample-events/openhands-events.jsonl" "$LATEST"

# ============================================================
# FOOTER
# ============================================================
{
echo ""
echo "======================================================================"
echo "EXPORT COMPLETE"
echo "======================================================================"
echo "Total lines: $(wc -l < "$OUTFILE")"
echo "Total size:  $(du -h "$OUTFILE" | cut -f1)"
echo "======================================================================"
} >> "$OUTFILE"

echo ""
echo "✅ Text file imeundwa:"
echo "   $OUTFILE"
ls -lh "$OUTFILE"
echo ""
echo "=== Preview (mistari 20 ya kwanza) ==="
head -20 "$OUTFILE"
