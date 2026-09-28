---
name: code
description: edit code safely, find things fast, run tests
---
# Code
- Map first: `xmd-map .` ; find symbols: `grep -rn "name" --include=*.ts . | head -20`.
- Read only what you need: `sed -n '40,90p' file`.
- Small edits: `python3 - <<'PY'` with str.replace on the exact text, or write_file for new/short files.
- After editing run the fastest check available (e.g. `node --check f.js`, `python3 -m py_compile f.py`, `npm test --silent 2>&1 | tail -20`).
- Keep commands quiet: add `--silent`, `-q`, `| tail -20`.
