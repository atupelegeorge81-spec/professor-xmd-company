#!/usr/bin/env bash

set -e

PROJECT_DIR="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
OUTPUT_DIR="$HOME/Downloads"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="$OUTPUT_DIR/${PROJECT_NAME}_FULL_SOURCE_${TIMESTAMP}.txt"

mkdir -p "$OUTPUT_DIR"

echo "============================================================" > "$OUTPUT_FILE"
echo "PROJECT: $PROJECT_NAME" >> "$OUTPUT_FILE"
echo "ROOT: $PROJECT_NAME" >> "$OUTPUT_FILE"
echo "GENERATED: $(date)" >> "$OUTPUT_FILE"
echo "============================================================" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

echo "==================== DIRECTORY TREE ========================" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

find . \
  -type d \
  \( \
    -name node_modules \
    -o -name dist \
    -o -name build \
    -o -name .git \
    -o -name .vite \
    -o -name coverage \
    -o -name .cache \
    -o -name .next \
    -o -name out \
    -o -name target \
  \) -prune \
  -o -type d -print \
  | sort \
  | sed "s#^\./#${PROJECT_NAME}/#" >> "$OUTPUT_FILE"

echo >> "$OUTPUT_FILE"
echo "====================== ALL FILES ===========================" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

find . \
  -type d \
  \( \
    -name node_modules \
    -o -name dist \
    -o -name build \
    -o -name .git \
    -o -name .vite \
    -o -name coverage \
    -o -name .cache \
    -o -name .next \
    -o -name out \
    -o -name target \
  \) -prune \
  -o -type f -print \
  | sort \
  | sed "s#^\./#${PROJECT_NAME}/#" >> "$OUTPUT_FILE"

echo >> "$OUTPUT_FILE"
echo "============================================================" >> "$OUTPUT_FILE"
echo "                 SOURCE FILE CONTENTS" >> "$OUTPUT_FILE"
echo "============================================================" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

is_source_file() {
    case "$1" in
        *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.sass|*.less|\
        *.html|*.htm|*.vue|*.svelte|*.astro|*.md|*.mdx|*.yaml|*.yml|\
        *.xml|*.svg|*.sql|*.graphql|*.gql|*.env.example|*.gitignore|\
        *.sh|*.bash|*.zsh|*.py|*.go|*.rs|*.java|*.kt|*.c|*.cpp|*.h|*.hpp)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

while IFS= read -r FILE; do

    RELATIVE="${FILE#./}"

    # Ignore generated/build directories completely
    case "$RELATIVE" in
        node_modules/*|dist/*|build/*|.git/*|.vite/*|coverage/*|.cache/*|.next/*|out/*|target/*)
            continue
            ;;
    esac

    # Only put source/code file CONTENTS into the report.
    if is_source_file "$RELATIVE"; then

        echo >> "$OUTPUT_FILE"
        echo "------------------------------------------------------------" >> "$OUTPUT_FILE"
        echo "FILE: ${PROJECT_NAME}/${RELATIVE}" >> "$OUTPUT_FILE"
        echo "------------------------------------------------------------" >> "$OUTPUT_FILE"

        # Skip binary files even if their extension happens to match.
        if file "$FILE" | grep -qiE 'text|json|javascript|typescript|xml|svg|script'; then
            cat "$FILE" >> "$OUTPUT_FILE"
        else
            echo "[BINARY/NON-TEXT FILE — CONTENT NOT EXPORTED]" >> "$OUTPUT_FILE"
        fi

        echo >> "$OUTPUT_FILE"
    fi

done < <(
    find . \
      -type d \
      \( \
        -name node_modules \
        -o -name dist \
        -o -name build \
        -o -name .git \
        -o -name .vite \
        -o -name coverage \
        -o -name .cache \
        -o -name .next \
        -o -name out \
        -o -name target \
      \) -prune \
      -o -type f -print \
      | sort
)

echo >> "$OUTPUT_FILE"
echo "============================================================" >> "$OUTPUT_FILE"
echo "EXPORT COMPLETE" >> "$OUTPUT_FILE"
echo "============================================================" >> "$OUTPUT_FILE"
echo "Project: $PROJECT_NAME" >> "$OUTPUT_FILE"
echo "Output: $OUTPUT_FILE" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

echo
echo "✅ IMEISHA"
echo
echo "📁 Project: $PROJECT_NAME"
echo "📄 Output:"
echo "$OUTPUT_FILE"
echo
echo "🚫 Excluded:"
echo "   node_modules/"
echo "   dist/"
echo "   build/"
echo "   .git/"
echo "   .vite/"
echo "   coverage/"
echo "   .cache/"
echo "   .next/"
echo "   out/"
echo "   target/"
echo
