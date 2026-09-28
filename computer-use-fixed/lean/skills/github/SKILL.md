---
name: github
description: clone, commit, push to GitHub and return the commit link
---
# GitHub
- Clone: `git clone --depth 1 <url> repo && cd repo` (shallow = fast, small output).
- Understand the repo cheaply: `xmd-map .` (never cat every file).
- Identity (once): `git config user.name "XMD Agent" && git config user.email "xmd@agent.local"` if missing.
- Push everything in one step: `xmd-push "short message"` → prints `OK <sha> <commit-url>` or the error.
- Auth: pushing needs `GITHUB_TOKEN` in the environment. If `xmd-push` says the token is missing, STOP and report it — do not try other auth tricks.
- Never print tokens or `.env` files.
