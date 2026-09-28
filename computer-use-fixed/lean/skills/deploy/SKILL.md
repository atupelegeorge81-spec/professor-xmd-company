---
name: deploy
description: host a static site or built app and return the live URL
---
# Deploy
1. Build first if needed (`npm ci && npm run build`); static sites need no build.
2. Run `xmd-deploy <dir>` (dir = folder with index.html, e.g. `.`, `dist`, `build`, `out`).
   It picks Netlify (NETLIFY_AUTH_TOKEN) or Vercel (VERCEL_TOKEN) and prints `OK <url>` or a clear error.
3. Verify with `xmd-check <url>` (status + title). Put the URL in the finish report.
If no deploy token exists, finish and say which token is needed.
